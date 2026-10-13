// OCR endpoints. For now we only OCR offer letters (placement verification);
// salary slips piggyback the same vision extractor with a different schema hint.
//
// We accept base64 data URLs in the request body (5mb JSON limit on the app
// already; no multer needed). The actual file bytes never touch local disk —
// we just forward them to OpenAI and persist the extracted fields.
//
// Two input shapes are supported:
//   • image/*           → sent as `image_url` content (gpt-4o vision)
//   • application/pdf   → sent as `file` content (gpt-4o file input). The
//                         model receives the rendered pages directly; no
//                         client-side rasterisation needed.
//
// When OPENAI_API_KEY is missing we still return a deterministic, plausible
// stub so the demo flow doesn't dead-end without a key.

import { Router } from 'express'
import { z } from 'zod'
import { openai, CHAT_MODEL, hasOpenAI } from '../llm/openai.js'
import { requireAuth } from '../auth/middleware.js'

const r = Router()
r.use(requireAuth)

function mimeOfDataUrl(dataUrl) {
  const m = /^data:([^;,]+)[;,]/i.exec(dataUrl || '')
  return m ? m[1].toLowerCase() : null
}

const OFFER_LETTER_SCHEMA_HINT = `{
  "placementDate":   "ISO date string when the placement was finalised (offer issued)",
  "onboardingDate":  "ISO date string for onboarding / induction",
  "joiningDate":     "ISO date string for actual day-1 of work",
  "salaryMonthly":   "monthly gross salary in INR as an integer",
  "noticePeriod":    "notice period text e.g. '30 days' or '1 month'",
  "venue":           "full work venue / address (city + state at minimum)",
  "role":            "designation / job title",
  "employerName":    "name of the issuing employer",
  "confidence":      "0..1 overall extraction confidence as a float"
}`

// Heuristic fallback when no LLM key is configured. Keeps the demo alive.
function stubOcr() {
  return {
    placementDate:  new Date().toISOString().slice(0, 10),
    onboardingDate: new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10),
    joiningDate:    new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10),
    salaryMonthly:  14000,
    noticePeriod:   '30 days',
    venue:          'As mentioned in the appointment letter',
    role:           'Customer Service Associate',
    employerName:   'Employer (extracted from letter)',
    confidence:     0.55,
    _stub: true,
  }
}

r.post('/offer-letter', async (req, res, next) => {
  try {
    const body = z.object({
      dataUrl: z.string().min(50),          // data:image/...;base64,...  or  data:application/pdf;base64,...
      filename: z.string().optional(),
    }).parse(req.body)

    if (!hasOpenAI()) return res.json({ ocr: stubOcr() })

    const mime = mimeOfDataUrl(body.dataUrl)
    const isPdf = mime === 'application/pdf'
    const isImage = mime?.startsWith('image/')
    if (!isPdf && !isImage) {
      return res.status(400).json({ error: 'unsupported_mime', mime })
    }

    // Content shape depends on input: PDFs use the `file` part type (gpt-4o
    // reads them natively); images use `image_url`. Either way we get back a
    // single JSON object matching OFFER_LETTER_SCHEMA_HINT.
    const sys = `You are a precise document extraction engine. The user will send you an Indian employment offer / appointment letter as ${isPdf ? 'a PDF' : 'an image'}. Extract the fields and return ONLY a JSON object matching the schema. Use ISO dates (YYYY-MM-DD). If a field is not clearly stated, set it to null and lower the confidence. Salary should be the MONTHLY gross figure in INR (integer); if only annual CTC is given, divide by 12.`

    const userContent = isPdf
      ? [
          { type: 'text', text: 'Extract the offer letter fields from this PDF. Return JSON only.' },
          { type: 'file', file: { file_data: body.dataUrl, filename: body.filename || 'offer-letter.pdf' } },
        ]
      : [
          { type: 'text', text: 'Extract the offer letter fields from this image. Return JSON only.' },
          { type: 'image_url', image_url: { url: body.dataUrl } },
        ]

    const resp = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 800,
      messages: [
        { role: 'system', content: sys + `\nSchema: ${OFFER_LETTER_SCHEMA_HINT}` },
        { role: 'user', content: userContent },
      ],
    })
    const txt = resp.choices?.[0]?.message?.content
    let parsed = null
    try { parsed = JSON.parse(txt) } catch {}
    if (!parsed) return res.json({ ocr: stubOcr() })
    return res.json({ ocr: parsed })
  } catch (e) { next(e) }
})

export default r
