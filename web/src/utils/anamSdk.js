// Lazy-load the Anam browser SDK from a CDN. Returns the createClient factory
// from window.anam once loaded. We avoid bundling the SDK so it only loads when
// the user opens an avatar canvas.

let _loader = null

const CDN = 'https://esm.sh/@anam-ai/js-sdk@latest'

export async function loadAnam() {
  if (_loader) return _loader
  _loader = (async () => {
    try {
      const mod = await import(/* @vite-ignore */ CDN)
      return mod
    } catch (e) {
      console.error('[anam] SDK load failed', e)
      throw new Error('Failed to load Anam SDK from CDN.')
    }
  })()
  return _loader
}
