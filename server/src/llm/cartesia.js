// Cartesia TTS — phrase-by-phrase MP3 synthesis. Used for voice-mode calls
// where we don't need lip-sync (no Anam avatar in the picture).
//
// Single-round-trip /tts/bytes endpoint, ~150–400 ms per phrase. The browser
// queues the MP3 blobs and plays them seamlessly.

const CARTESIA_BASE = 'https://api.cartesia.ai'
const CARTESIA_VERSION = '2024-06-10'

const DEFAULT_MODEL = process.env.CARTESIA_MODEL_ID || 'sonic-2'

export function cartesiaConfigured() {
  return !!(process.env.CARTESIA_API_KEY && process.env.CARTESIA_VOICE_ID)
}

export async function cartesiaSynthesize({ text, voiceId, language = 'en' }) {
  const apiKey = process.env.CARTESIA_API_KEY
  if (!apiKey) {
    const e = new Error('CARTESIA_API_KEY not configured')
    e.code = 'cartesia_not_configured'
    throw e
  }
  const id = voiceId || process.env.CARTESIA_VOICE_ID
  if (!id) {
    const e = new Error('CARTESIA_VOICE_ID not configured')
    e.code = 'cartesia_not_configured'
    throw e
  }

  const body = {
    model_id: DEFAULT_MODEL,
    transcript: text,
    voice: { mode: 'id', id },
    output_format: {
      container: 'mp3',
      encoding: 'mp3',
      sample_rate: 44100,
      bit_rate: 128000,
    },
    language,
  }

  const res = await fetch(`${CARTESIA_BASE}/tts/bytes`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Cartesia-Version': CARTESIA_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const err = new Error(`Cartesia ${res.status}: ${txt.slice(0, 200)}`)
    err.status = res.status
    throw err
  }
  // Return raw audio bytes (MP3)
  const buf = await res.arrayBuffer()
  return Buffer.from(buf)
}
