import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell, PageHeader } from '@/components/layout/PageShell'
import QRScannerModal from '@/components/qr/QRScannerModal'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'

export default function ScanPage() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(true)

  return (
    <PageShell>
      <PageHeader
        title="QR Check-in & Out"
        subtitle="Point camera at physical parking spot QR code"
      />

      <div className="mx-auto max-w-lg p-6 text-center space-y-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-accent/15 text-accent shadow-inner">
          <Icon name="qr" size={42} />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-ink">ParkShare Spot Scanner</h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            Scan the static printed QR code mounted at your reserved parking spot. The system automatically verifies your booking window and processes check-in or check-out.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase">
              <Icon name="check" size={14} /> Check-In
            </span>
            <p className="text-xs text-muted">
              Scan on arrival. Activates your parking spot reservation immediately.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase">
              <Icon name="car" size={14} /> Check-Out
            </span>
            <p className="text-xs text-muted">
              Scan when leaving. Calculates stay duration and releases the slot.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            className="w-full flex items-center justify-center gap-2 text-base font-bold shadow-lg"
            onClick={() => setIsOpen(true)}
          >
            <Icon name="camera" size={20} />
            Open Camera Scanner
          </Button>

          <Button
            variant="ghost"
            onClick={() => navigate('/bookings')}
            className="w-full text-muted"
          >
            Go to My Bookings
          </Button>
        </div>

        <QRScannerModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onScanSuccess={(res) => {
            // Can redirect or stay
          }}
        />
      </div>
    </PageShell>
  )
}
