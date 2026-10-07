import QRCode from 'qrcode'

/**
 * QR matrix + SVG path helper.
 *
 * Encoding is delegated to the `qrcode` package (byte mode, level M, automatic
 * mask/version selection). We keep a tiny local API so the UI only ever deals
 * with a module matrix, and emit a single SVG path — no canvas, no images.
 */

const ERROR_LEVEL = 'M'

/**
 * @param {string} text
 * @returns {{size:number, modules:boolean[][], version:number}}
 */
export function encodeQR(text) {
  const qr = QRCode.create(String(text), { errorCorrectionLevel: ERROR_LEVEL })
  const size = qr.modules.size
  const modules = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => Boolean(qr.modules.data[r * size + c])),
  )
  return { size, modules, version: qr.version }
}

/**
 * Builds one SVG path for every dark module.
 *
 * @param {{size:number, modules:boolean[][]}} qr
 * @param {number} quiet quiet-zone width in modules
 */
export function qrToPath(qr, quiet = 2) {
  if (!qr?.size || !Array.isArray(qr.modules)) return { path: '', viewBox: '0 0 1 1' }

  const parts = []
  for (let r = 0; r < qr.size; r += 1) {
    for (let c = 0; c < qr.size; c += 1) {
      if (qr.modules[r][c]) parts.push(`M${c + quiet} ${r + quiet}h1v1h-1z`)
    }
  }

  const side = qr.size + quiet * 2
  return { path: parts.join(''), viewBox: `0 0 ${side} ${side}` }
}
