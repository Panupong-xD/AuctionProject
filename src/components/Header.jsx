import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import MobileSidebar from './MobileSidebar'
import hamburgerIcon from '../assets/HamburgerMenu.png'

export default function Header() {
  const { currentUser, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="app-header">
      <div className="container">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button className="hamburger" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <img src={hamburgerIcon} alt="Menu" style={{ width: '24px', height: '24px' }} />
          </button>
          <div className="brand">
            <Link to="/" className="logo-link">PSAuction</Link>
          </div>
        </div>

        <nav className="nav">
          <Link to="/">Home</Link>
          {currentUser ? (
            <Link to="/create">My Listings</Link>
          ) : (
            <Link to="/login" title="You must sign in to manage listings" className="muted">My Listings</Link>
          )}
          <Link to="/howto">How to Bid</Link>
          {currentUser ? (
            <Link to="/payment">Payment</Link>
          ) : null}
          {currentUser ? <Link to="/profile">Profile</Link> : null}
        </nav>

        <div className="user-area">
          {currentUser ? (
            <div className="user-info">
              <div className="user-name">{currentUser.displayName || profile?.displayName || currentUser.email}</div>
              <div className="user-balance">฿ {profile?.balance ?? 0}</div>
              <button className="btn small" onClick={handleSignOut}>Sign out</button>
            </div>
          ) : (
            <Link to="/login" className="btn">Sign in</Link>
          )}
        </div>
      </div>
      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} currentUser={currentUser} />
    </header>
  )
}
