import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/layout/BottomNav'
import Landing from './pages/Landing'
import Search from './pages/Search'
import ListingDetail from './pages/ListingDetail'
import Bookings from './pages/Bookings'
import HostDashboard from './pages/HostDashboard'
import HostNewListing from './pages/HostNewListing'
import ScanPage from './pages/ScanPage'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/search" element={<Search />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/host/new" element={<HostNewListing />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </>
  )
}
