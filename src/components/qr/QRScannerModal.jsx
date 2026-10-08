import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { scanParking, payExtraAmount } from '@/api'
import { money, time } from '@/lib/format'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const toast = useToast()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)

  const [permissionState, setPermissionState] = useState('prompt') // 'prompt' | 'granted' | 'denied'
  const [activeTab, setActiveTab] = useState('camera') // 'camera' | 'manual'
  const [manualCode, setManualCode] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [facingMode, setFacingMode] = useState('environment') // 'environment' | 'user'
  const [torchOn, setTorchOn] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [isPayingExtra, setIsPayingExtra] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // Start/Stop camera stream
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera' || scanResult) {
      stopCamera()
      return
    }

    let isMounted = true

    async function startCamera() {
      try {
        stopCamera()
        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          await videoRef.current.play()
          setPermissionState('granted')
          requestAnimationFrame(scanVideoFrame)
        }
      } catch (err) {
        if (!isMounted) return
        console.warn('Camera access error:', err)
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionState('denied')
        } else {
          setPermissionState('denied')
        }
      }
    }

    startCamera()

    return () => {
      isMounted = false
      stopCamera()
    }
  }, [isOpen, activeTab, facingMode, scanResult])

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const toggleTorch = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return
    const capabilities = track.getCapabilities?.()
    if (capabilities?.torch) {
      try {
        const next = !torchOn
        await track.applyConstraints({ advanced: [{ torch: next }] })
        setTorchOn(next)
      } catch (e) {
        console.warn('Torch toggle failed', e)
      }
    } else {
      toast.push({ tone: 'neutral', title: 'Flashlight unavailable on this camera' })
    }
  }

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  const scanVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight
      canvas.width = video.videoWidth
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (code && code.data) {
        handleScannedCode(code.data)
        return
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanVideoFrame)
  }

  const handleScannedCode = async (data) => {
    if (isProcessing) return
    setIsProcessing(true)
    stopCamera()

    try {
      const response = await scanParking({ qrToken: data })
      setScanResult(response)
      toast.push({
        tone: 'success',
        title: response.action === 'CHECK_IN' ? 'Check-in Successful' : 'Check-out Processed',
        message: response.message,
      })
      if (onScanSuccess) onScanSuccess(response)
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Scan Rejected',
        message: err.friendlyMessage ?? err.message,
      })
      // Resume scanning after small delay
      setTimeout(() => {
        setIsProcessing(false)
        if (activeTab === 'camera') {
          requestAnimationFrame(scanVideoFrame)
        }
      }, 1800)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return

    setIsProcessing(true)
    try {
      const response = await scanParking({ locationCode: manualCode.trim() })
      setScanResult(response)
      toast.push({
        tone: 'success',
        title: response.action === 'CHECK_IN' ? 'Check-in Successful' : 'Check-out Processed',
        message: response.message,
      })
      if (onScanSuccess) onScanSuccess(response)
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Check-in/out Failed',
        message: err.friendlyMessage ?? err.message,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayExtra = async () => {
    if (!scanResult?.bookingId) return
    setIsPayingExtra(true)
    try {
      await payExtraAmount({
        bookingId: scanResult.bookingId,
        razorpayPaymentId: `pay_test_${Math.random().toString(36).slice(2, 10)}`,
      })
      setPaymentSuccess(true)
      toast.push({
        tone: 'success',
        title: 'Payment Confirmed',
        message: 'Extra time charges settled via Razorpay Test Mode.',
      })
      if (onScanSuccess) onScanSuccess({ ...scanResult, bookingStatus: 'COMPLETED', paymentStatus: 'COMPLETED' })
    } catch (err) {
      toast.push({ tone: 'error', title: 'Payment Failed', message: err.message })
    } finally {
      setIsPayingExtra(false)
    }
  }

  const handleClose = () => {
    stopCamera()
    setScanResult(null)
    setPaymentSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface border border-line shadow-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-surface-raised">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-accent">
              <Icon name="qr" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Kumbh Park QR Scanner</h3>
              <p className="text-xs text-muted">Scan spot QR for Check-in & Check-out</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-2 text-muted hover:bg-surface hover:text-ink transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5">
          {/* RESULT VIEW AFTER SCAN */}
          {scanResult ? (
            <div className="space-y-4">
              {scanResult.action === 'CHECK_IN' ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center space-y-3">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 shadow-inner">
                    <Icon name="check" size={32} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                      Checked In Active
                    </span>
                    <h4 className="mt-2 text-lg font-bold text-ink">{scanResult.spot?.title}</h4>
                    <p className="text-xs text-muted">{scanResult.spot?.address}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-3 text-left border border-line text-xs">
                    <div>
                      <span className="text-muted block">Checked In:</span>
                      <strong className="text-ink font-semibold">
                        {new Date(scanResult.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted block">Scheduled Until:</span>
                      <strong className="text-accent font-semibold">
                        {new Date(scanResult.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                  </div>

                  {scanResult.spot?.gateInstructions && (
                    <div className="rounded-xl bg-amber-500/10 p-3 text-left border border-amber-500/20 text-xs text-amber-800">
                      <strong>Gate Instructions:</strong> {scanResult.spot.gateInstructions}
                    </div>
                  )}

                  <p className="text-xs text-muted pt-1">
                    When leaving, scan the same physical QR code to check out!
                  </p>

                  <Button variant="primary" className="w-full mt-2" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              ) : (
                /* CHECK OUT RESULT */
                <div className="space-y-3">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-500/15 text-blue-600 mb-2">
                      <Icon name="car" size={26} />
                    </div>
                    <span className="inline-block rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 uppercase tracking-wider">
                      Check-Out Complete
                    </span>
                    <h4 className="mt-1 text-base font-bold text-ink">{scanResult.spot?.title}</h4>
                  </div>

                  {/* Pricing & Duration Breakdown */}
                  <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between pb-2 border-b border-line text-muted">
                      <span>Booking Code</span>
                      <span className="font-mono font-bold text-ink">{scanResult.bookingCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Scheduled End:</span>
                      <span className="font-medium text-ink">
                        {new Date(scanResult.breakdown.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Actual Check-out:</span>
                      <span className="font-medium text-ink">
                        {new Date(scanResult.breakdown.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Base Upfront Paid:</span>
                      <span className="font-medium text-ink">₹{scanResult.breakdown.baseAmount}</span>
                    </div>

                    {scanResult.breakdown.extraHours > 0 ? (
                      <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20 space-y-1.5 mt-2">
                        <div className="flex justify-between text-amber-900 font-semibold">
                          <span>Extra Overdue Time:</span>
                          <span>+{scanResult.breakdown.extraHours} hr (@ ₹{scanResult.breakdown.hourlyRate}/hr)</span>
                        </div>
                        <div className="flex justify-between text-amber-900 text-sm font-bold pt-1 border-t border-amber-500/20">
                          <span>Extra Charge Due:</span>
                          <span className="text-red-600">₹{scanResult.breakdown.extraAmount}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-emerald-500/10 p-2.5 border border-emerald-500/20 text-center text-emerald-700 font-semibold">
                        Checked out on time! No extra charge.
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-line text-ink">
                      <span>Total Stay Amount:</span>
                      <span className="text-accent">₹{scanResult.breakdown.totalAmount}</span>
                    </div>
                  </div>

                  {/* Payment Action If Extra Due */}
                  {scanResult.breakdown.extraAmount > 0 && !paymentSuccess ? (
                    <div className="space-y-2 pt-1">
                      <div className="rounded-xl bg-surface-raised border border-line p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                          RZP
                        </div>
                        <div className="text-xs flex-1">
                          <strong className="block text-ink">Razorpay Test Mode Order</strong>
                          <span className="text-muted">Order ID: {scanResult.breakdown.razorpayOrder?.id}</span>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3"
                        onClick={handlePayExtra}
                        disabled={isPayingExtra}
                      >
                        {isPayingExtra ? 'Processing Razorpay...' : `Pay Now ₹${scanResult.breakdown.extraAmount}`}
                      </Button>
                    </div>
                  ) : paymentSuccess ? (
                    <div className="rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20 text-center text-emerald-700 font-semibold text-xs">
                      Payment received! Status is now COMPLETED.
                    </div>
                  ) : null}

                  <Button variant="secondary" className="w-full" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* SCANNER VIEW */
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-surface-raised p-1 border border-line">
                <button
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'camera'
                      ? 'bg-surface text-accent shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Icon name="camera" size={15} />
                  Camera Scan
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'manual'
                      ? 'bg-surface text-accent shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Icon name="edit" size={15} />
                  Enter Code
                </button>
              </div>

              {activeTab === 'camera' ? (
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full object-cover"
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Reticle Scanner Overlay */}
                  <div className="relative z-10 h-3/4 w-3/4 rounded-2xl border-2 border-accent/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse shadow-[0_0_12px_var(--color-accent)]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="bg-black/60 px-3 py-1 rounded-full text-[11px] text-white/90 font-medium">
                        Align physical spot QR inside box
                      </p>
                    </div>
                  </div>

                  {/* Camera Controls Bar */}
                  <div className="absolute bottom-3 inset-x-3 z-20 flex justify-between items-center px-2">
                    <button
                      onClick={toggleTorch}
                      className={`h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                        torchOn ? 'bg-amber-400 text-black' : 'bg-black/50 text-white hover:bg-black/70'
                      }`}
                      title="Toggle Flashlight"
                    >
                      <Icon name="zap" size={18} />
                    </button>
                    <button
                      onClick={switchCamera}
                      className="h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                      title="Switch Camera"
                    >
                      <Icon name="refresh" size={18} />
                    </button>
                  </div>

                  {/* Permission Denied / Error State */}
                  {permissionState === 'denied' && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-surface p-6 text-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                        <Icon name="camera" size={24} />
                      </div>
                      <h4 className="text-sm font-bold text-ink">Camera Access Denied</h4>
                      <p className="text-xs text-muted max-w-xs">
                        Camera permissions are disabled in your browser. Please allow camera access or use manual code entry.
                      </p>
                      <Button variant="secondary" onClick={() => setActiveTab('manual')}>
                        Enter Location Code Instead
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* MANUAL CODE FALLBACK */
                <form onSubmit={handleManualSubmit} className="space-y-3 py-2">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-ink">
                      Spot Name or Location Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sagar Colony or s1"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface-raised px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                    />
                    <p className="text-[11px] text-muted">
                      Use this fallback if lighting is low or your phone camera cannot read the printed QR code.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    className="w-full"
                    type="submit"
                    disabled={!manualCode.trim() || isProcessing}
                  >
                    {isProcessing ? 'Processing Check-in/out...' : 'Submit Code'}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
