import { useState, useEffect } from 'react'
import { getSpotQr, regenerateSpotQr } from '@/api'
import QRCode from '@/components/ui/QRCode'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

export default function HostQRCard({ spot }) {
  const toast = useToast()
  const [qrData, setQrData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!spot?.id) return
    loadQr()
  }, [spot?.id])

  const loadQr = async () => {
    setLoading(true)
    try {
      const data = await getSpotQr(spot.id)
      setQrData(data)
    } catch (err) {
      console.warn('Could not load spot QR:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const updated = await regenerateSpotQr(spot.id, 'Host requested new physical QR plaque')
      setQrData(updated)
      setShowConfirm(false)
      toast.push({
        tone: 'success',
        title: 'QR Code Reissued',
        message: 'Old physical QR codes have stopped working immediately. Please print the new code.',
      })
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Regeneration Failed',
        message: err.message,
      })
    } finally {
      setRegenerating(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (!spot) return null

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent uppercase tracking-wider mb-1">
            Static Physical QR Plaque
          </span>
          <h3 className="text-base font-bold text-ink">Parking Spot Check-In/Out QR</h3>
          <p className="text-xs text-muted">
            Print and mount this static QR code at your parking spot entrance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
            <Icon name="printer" size={14} />
            Print Plaque
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirm(true)}
            className="text-red-500 hover:bg-red-500/10 flex items-center gap-1"
          >
            <Icon name="refresh" size={14} />
            Reissue
          </Button>
        </div>
      </div>

      {/* QR Code Plaque Preview Card */}
      <div className="rounded-2xl border-2 border-dashed border-line bg-surface-raised p-6 text-center max-w-sm mx-auto shadow-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md bg-accent flex items-center justify-center text-white font-black text-xs">
            P
          </div>
          <span className="font-bold text-sm tracking-wide text-ink">ParkShare Spot Pass</span>
        </div>

        <div className="mx-auto w-fit rounded-xl bg-white p-4 shadow-md border border-slate-200">
          {qrData?.pngDataUrl ? (
            <img src={qrData.pngDataUrl} alt="Spot QR Code" className="h-44 w-44 object-contain" />
          ) : qrData?.qrToken ? (
            <QRCode value={qrData.qrToken} size={176} />
          ) : (
            <div className="h-44 w-44 flex items-center justify-center text-xs text-muted">
              {loading ? 'Generating QR...' : 'QR unavailable'}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1">
          <h4 className="font-bold text-sm text-ink">{spot.title}</h4>
          <p className="text-xs text-muted">{spot.address}</p>
          <div className="pt-2">
            <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              ₹{spot.priceHour ?? spot.pricePerHour}/hr • Scan to Check In / Check Out
            </span>
          </div>
        </div>
      </div>

      {/* Reissue Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-line p-5 space-y-4 shadow-2xl">
            <div className="h-10 w-10 rounded-full bg-red-500/15 text-red-600 flex items-center justify-center mx-auto">
              <Icon name="alert-triangle" size={22} />
            </div>
            <div className="text-center">
              <h4 className="font-bold text-base text-ink">Regenerate Spot QR Code?</h4>
              <p className="text-xs text-muted mt-1">
                This will <strong>immediately invalidate</strong> the current physical printed QR code. Anyone scanning the old code will be rejected until you print and replace it with the new one.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowConfirm(false)}
                disabled={regenerating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? 'Reissuing...' : 'Yes, Invalidate & Reissue'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
