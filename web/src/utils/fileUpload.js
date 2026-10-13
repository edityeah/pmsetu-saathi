// File → base64 data URL helpers.
//
// We don't have multer on the backend; every "upload" is a JSON POST whose
// body carries a base64 data URL. Express body limit is 5 MB which fits the
// scanned-PDF / phone-photo cases that demo flows produce.
//
// PDFs are supported end-to-end: gpt-4o accepts inline PDF data URLs via the
// `file` content type in chat completions, so we don't need client-side
// rasterisation. The same dropzone happily takes images or PDFs.

export const ACCEPT_LETTER = 'image/png,image/jpeg,image/webp,image/heic,application/pdf'
// Backwards-compat alias — older imports still reference ACCEPT_IMAGE.
export const ACCEPT_IMAGE = ACCEPT_LETTER
export const MAX_SIZE_MB = 4

export function isPdfDataUrl(dataUrl) {
  return /^data:application\/pdf[;,]/i.test(dataUrl || '')
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('no_file'))
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return reject(new Error(`File too large (>${MAX_SIZE_MB} MB). Try a smaller photo.`))
    }
    const fr = new FileReader()
    fr.onerror = () => reject(fr.error || new Error('read_failed'))
    fr.onload = () => resolve(String(fr.result || ''))
    fr.readAsDataURL(file)
  })
}
