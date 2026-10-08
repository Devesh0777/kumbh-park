import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import { useApp } from '@/context/AppContext'

/**
 * Role-Based Login Modal & Demo Role Switcher
 * Provides separate login tabs for USER, HOST, and ADMIN with instant Demo account shortcuts.
 */
export default function LoginModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { user, setUserRole } = useApp()
  const [activeTab, setActiveTab] = useState('user') // 'user' | 'host' | 'admin'

  if (!isOpen) return null

  const handleLoginUser = (name = 'Devv') => {
    if (setUserRole) setUserRole('user', { name, id: 'u_devv', isDemo: true })
    onClose?.()
    navigate('/search')
  }

  const handleLoginHost = (name = 'Sunita Deshmukh') => {
    if (setUserRole) setUserRole('host', { name, id: 'h1', isDemo: true })
    onClose?.()
    navigate('/host')
  }

  const handleLoginAdmin = (name = 'Kumbh Admin Controller') => {
    if (setUserRole) setUserRole('admin', { name, id: 'admin_1', isDemo: true })
    onClose?.()
    navigate('/admin')
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[#0E151D]/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-[#FAF7F2] border-2 border-[#E2DDD3] shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#17212B] text-white px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-[#006B4F] text-[#FFD166] text-[12px] font-black font-mono">
              KP
            </div>
            <div>
              <h3 className="text-[15px] font-black uppercase font-serif tracking-wider">
                KUMBH PARK LOGIN
              </h3>
              <p className="text-[10px] text-white/70">Select role to enter platform</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Role Tabs: USER | HOST | ADMIN */}
        <div className="grid grid-cols-3 bg-[#EFEADF] p-1.5 border-b border-[#E2DDD3] text-center text-[12px] font-mono font-bold uppercase">
          <button
            type="button"
            onClick={() => setActiveTab('user')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'user' ? 'bg-[#006B4F] text-white shadow-xs' : 'text-[#66706B] hover:text-[#17212B]'
            }`}
          >
            1. USER
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('host')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'host' ? 'bg-[#006B4F] text-white shadow-xs' : 'text-[#66706B] hover:text-[#17212B]'
            }`}
          >
            2. HOST
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'admin' ? 'bg-[#006B4F] text-white shadow-xs' : 'text-[#66706B] hover:text-[#17212B]'
            }`}
          >
            3. ADMIN
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-4">
          {/* USER TAB */}
          {activeTab === 'user' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white p-4 border border-[#E2DDD3] space-y-2">
                <span className="text-[10px] font-mono font-black text-[#006B4F] uppercase tracking-wider block">
                  PILGRIM / DRIVER PORTAL
                </span>
                <h4 className="text-base font-black text-[#17212B] font-serif">
                  Find & Pre-Book Verified Parking
                </h4>
                <p className="text-[12px] text-[#66706B] leading-relaxed">
                  Search nearby compounds, book guaranteed bays, and access instant offline QR gate permits.
                </p>
              </div>

              {/* Demo Account Shortcut */}
              <div className="rounded-2xl bg-[#EAF2EC] p-3.5 border border-[#006B4F]/30 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#006B4F]">
                  <span>DEMO ACCOUNT</span>
                  <span className="bg-[#006B4F] text-white px-2 py-0.5 rounded text-[9.5px]">USER</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[14px] font-black text-[#17212B] block">Devv</span>
                    <span className="text-[10.5px] font-mono text-[#66706B]">devv@kumbhpark.com</span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleLoginUser('Devv')}
                    className="bg-[#006B4F] hover:bg-[#00472B] text-white font-bold text-[12px] uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Continue as Devv →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* HOST TAB */}
          {activeTab === 'host' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white p-4 border border-[#E2DDD3] space-y-2">
                <span className="text-[10px] font-mono font-black text-[#E9A83A] uppercase tracking-wider block">
                  HOST PROPERTY PORTAL
                </span>
                <h4 className="text-base font-black text-[#17212B] font-serif">
                  Manage Driveway & Ashram Listings
                </h4>
                <p className="text-[12px] text-[#66706B] leading-relaxed">
                  Track live occupancy, view earnings, process check-ins, and print QR plaques.
                </p>
              </div>

              {/* Demo Host Account Shortcut */}
              <div className="rounded-2xl bg-[#FFF5DF] p-3.5 border border-[#E9A83A]/40 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#17212B]">
                  <span>DEMO ACCOUNT</span>
                  <span className="bg-[#E9A83A] text-[#17212B] px-2 py-0.5 rounded text-[9.5px] font-black">HOST</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[14px] font-black text-[#17212B] block">Sunita Deshmukh</span>
                    <span className="text-[10.5px] font-mono text-[#66706B]">sunita@nashikpark.in</span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleLoginHost('Sunita Deshmukh')}
                    className="bg-[#17212B] hover:bg-[#0E151D] text-white font-bold text-[12px] uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Host Dashboard →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN TAB */}
          {activeTab === 'admin' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white p-4 border border-[#E2DDD3] space-y-2">
                <span className="text-[10px] font-mono font-black text-[#8B2E21] uppercase tracking-wider block">
                  KUMBH OPERATIONS CONSOLE
                </span>
                <h4 className="text-base font-black text-[#17212B] font-serif">
                  Police & Sector Command Admin
                </h4>
                <p className="text-[12px] text-[#66706B] leading-relaxed">
                  Verify host listings, monitor city-wide Kumbh sector occupancy, and resolve traffic issues.
                </p>
              </div>

              {/* Demo Admin Shortcut */}
              <div className="rounded-2xl bg-red-50 p-3.5 border border-red-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#8B2E21]">
                  <span>DEMO ACCOUNT</span>
                  <span className="bg-[#8B2E21] text-white px-2 py-0.5 rounded text-[9.5px]">ADMIN</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[14px] font-black text-[#17212B] block">Kumbh Admin Controller</span>
                    <span className="text-[10.5px] font-mono text-[#66706B]">admin@kumbhpark.gov.in</span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleLoginAdmin('Kumbh Admin Controller')}
                    className="bg-[#8B2E21] hover:bg-[#6E2217] text-white font-bold text-[12px] uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Admin Console →
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
