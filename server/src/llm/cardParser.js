// CardParser — a streaming filter that extracts `<<<KSKCARD>>> {...} <<<END>>>`
// JSON fences out of an LLM's text stream and emits them as separate "card"
// events so the client can render them as rich UI components.
//
// The LLM is instructed (in the system prompt) to embed structured JSON inside
// these fences when the user's intent maps to a card type (course_list,
// eligibility, attendance, etc). The fences are surgically removed from the
// text the client renders as the chat bubble, leaving the conversational
// wrapper text untouched.
//
// Design notes
// ─────────────
//  * Fences may span multiple deltas (the LLM streams characters at a time).
//    We hold a small "pending" buffer of the last few chars in case they form
//    the start of a marker.
//  * The opening marker is `<<<KSKCARD>>>`; closing marker is `<<<END>>>`.
//    Both are exactly 13 / 9 chars so we never need to buffer more than a
//    dozen chars at idle.
//  * If JSON parsing fails for a fence, we emit the raw text instead so the
//    user at least sees what was meant — no silent data loss.
//
// Usage
// ─────
//  const parser = new CardParser({ onText, onCard })
//  parser.feed("Here are some courses: <<<KSKCARD>>>{\"type\":\"…")
//  parser.feed("\"course_list\",\"items\":[…]}<<<END>>>\nWant details?")
//  parser.flush()   // call once the stream is done

const OPEN  = '<<<KSKCARD>>>'
const CLOSE = '<<<END>>>'
// Largest prefix-of-marker that could be hiding in our buffer.
const MAX_PENDING = Math.max(OPEN.length, CLOSE.length) - 1

export class CardParser {
  constructor({ onText, onCard } = {}) {
    this.onText = onText || (() => {})
    this.onCard = onCard || (() => {})
    this.inFence = false   // currently between OPEN and CLOSE markers
    this.buffer  = ''       // bytes we've consumed but not yet flushed
    this.fenceBuf = ''      // bytes inside a fence, awaiting CLOSE
  }

  feed(chunk) {
    if (!chunk) return
    this.buffer += chunk

    // Loop because a single chunk may contain multiple markers.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!this.inFence) {
        const openIdx = this.buffer.indexOf(OPEN)
        if (openIdx === -1) {
          // No fence in sight. Flush everything except the last few chars
          // (which might be the start of a fence that will arrive next).
          const safe = Math.max(0, this.buffer.length - MAX_PENDING)
          if (safe > 0) {
            this.onText(this.buffer.slice(0, safe))
            this.buffer = this.buffer.slice(safe)
          }
          return
        }
        // Emit text up to the fence opener, then enter fence mode.
        if (openIdx > 0) this.onText(this.buffer.slice(0, openIdx))
        this.buffer = this.buffer.slice(openIdx + OPEN.length)
        this.inFence = true
        this.fenceBuf = ''
      }

      // In fence mode — accumulate until CLOSE.
      const closeIdx = this.buffer.indexOf(CLOSE)
      if (closeIdx === -1) {
        // Hold everything except the trailing few chars (might start CLOSE).
        const hold = Math.max(0, this.buffer.length - MAX_PENDING)
        if (hold > 0) {
          this.fenceBuf += this.buffer.slice(0, hold)
          this.buffer = this.buffer.slice(hold)
        }
        return
      }
      this.fenceBuf += this.buffer.slice(0, closeIdx)
      this.buffer = this.buffer.slice(closeIdx + CLOSE.length)
      this._emitFence(this.fenceBuf)
      this.fenceBuf = ''
      this.inFence = false
    }
  }

  flush() {
    if (this.inFence) {
      // Stream ended mid-fence — emit what we have as text (we won't drop
      // user-visible content silently).
      this.onText(OPEN + this.fenceBuf + this.buffer)
    } else if (this.buffer) {
      this.onText(this.buffer)
    }
    this.buffer = ''
    this.fenceBuf = ''
    this.inFence = false
  }

  _emitFence(raw) {
    const trimmed = (raw || '').trim()
    if (!trimmed) return
    let parsed = null
    try {
      parsed = JSON.parse(trimmed)
    } catch (e) {
      console.warn('[cardParser] invalid JSON in fence, emitting as text:', e.message)
      this.onText(`\n${trimmed}\n`)
      return
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.type) {
      this.onText(`\n${trimmed}\n`)
      return
    }
    this.onCard(parsed)
  }
}
