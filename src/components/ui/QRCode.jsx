import { useEffect, useMemo, useState } from 'react'
import QRCodeLib from 'qrcode'
import { encodeQR, qrToPath } from '@/lib/qr'
import { cn } from '@/lib/cn'

/** Renders the check-in QR as crisp SVG or high-res image */
export default function QRCode({ value, size = 168, className, label = 'Check-in QR' }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    if (!value) return
    let active = true
    QRCodeLib.toDataURL(String(value), {
      width: size * 2,
      margin: 1,
      color: { dark: '#111827', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [value, size])

  const { path, viewBox } = useMemo(() => {
    try {
      return qrToPath(encodeQR(String(value))) ?? { path: null, viewBox: null }
    } catch {
      return { path: null, viewBox: null }
    }
  }, [value])

  return (
    <div
      className={cn(
        'rounded-[14px] border border-line bg-white p-2 shadow-sm flex items-center justify-center overflow-hidden',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        <img src={dataUrl} alt={label} className="w-full h-full object-contain" />
      ) : path ? (
        <svg viewBox={viewBox} width="100%" height="100%" role="img" aria-label={label} shapeRendering="crispEdges">
          <rect width="100%" height="100%" fill="#ffffff" />
          <path d={path} fill="#1a1a1a" />
        </svg>
      ) : (
        <div className="grid place-items-center rounded-[14px] bg-surface-sunken text-[12px] text-muted w-full h-full">
          QR Generating...
        </div>
      )}
    </div>
  )
}
