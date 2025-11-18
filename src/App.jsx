import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Header from './components/Header'
import Auctions from './pages/Auctions'
import AuctionDetail from './pages/AuctionDetail'
import Profile from './pages/Profile'
import CreateAuction from './pages/CreateAuction'
import SellerAuctions from './pages/SellerAuctions'
import Login from './pages/Login'
import HowTo from './pages/HowTo'
import Payment from './pages/Payment'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './contexts/AuthContext'

export default function App() {
  function Processor() {
    const { processEndedAuctions } = useAuth()
    useEffect(() => {
      if (!processEndedAuctions) return
      processEndedAuctions()
      const t = setInterval(() => {
        processEndedAuctions()
      }, 30000)
      return () => clearInterval(t)
    }, [processEndedAuctions])
    return null
  }
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Processor />
        <main>
          <Routes>
            <Route path="/" element={<Auctions />} />
            <Route path="/auctions/:id" element={<AuctionDetail />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><SellerAuctions /></ProtectedRoute>} />
            <Route path="/create/new" element={<ProtectedRoute><CreateAuction /></ProtectedRoute>} />
            <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/howto" element={<HowTo />} />
            <Route path="/topup" element={<Navigate to="/payment" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}
