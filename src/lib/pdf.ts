import * as pdfjsLib from 'pdfjs-dist'
// Self-hosted worker bundled by Vite — no CDN dependency, works offline.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjsLib }

export interface LoadResult {
  pdf: pdfjsLib.PDFDocumentProxy
}

export interface LoadCallbacks {
  onProgress?: (fraction: number) => void
  /** Called when the PDF is password protected. Must resolve with the password. */
  onPassword?: (updatePassword: (pw: string) => void, reason: number) => void
}

/** Load a PDF from a File with correct typing for pdf.js v4 (Uint8Array buffer). */
export async function loadPdf(file: File, cb: LoadCallbacks = {}): Promise<LoadResult> {
  const buffer = await file.arrayBuffer()
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
  })
  if (cb.onProgress) {
    task.onProgress = (p: { loaded: number; total?: number }) => {
      if (p.total) cb.onProgress!(p.loaded / p.total)
    }
  }
  if (cb.onPassword) {
    task.onPassword = cb.onPassword
  }
  const pdf = await task.promise
  return { pdf }
}
