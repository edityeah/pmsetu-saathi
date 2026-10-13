// Thumbnail-sized preview that works for both image and PDF data URLs.
// Images go in <img>; PDFs render as an icon + clickable link that opens
// the inline data URL in a new tab so reviewers can still read the file.

import { FileText } from 'lucide-react'
import { isPdfDataUrl } from '../utils/fileUpload.js'

export default function FilePreview({ url, alt = 'document', size = 'sm' }) {
  if (!url) return null
  const dims = size === 'lg'
    ? 'w-full h-32'
    : size === 'md'
      ? 'w-20 h-24'
      : 'w-12 h-14'
  const isPdf = isPdfDataUrl(url) || /\.pdf(\?|$)/i.test(url)
  if (isPdf) {
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className={`${dims} rounded-md border border-bdr-light bg-rose-50 flex flex-col items-center justify-center gap-1 hover:bg-rose-100 transition-colors`}>
        <FileText className="w-5 h-5 text-rose-600" />
        <span className="text-[9px] font-bold text-rose-700 uppercase tracking-wider">PDF</span>
      </a>
    )
  }
  return <img src={url} alt={alt} className={`${dims} object-cover rounded-md border border-bdr-light`} />
}
