import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function MobileSidebar({ open, onClose, currentUser }) {
  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [open])

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="sidebar-header">
          <div className="brand-mini">Pramoon</div>
          <button className="btn ghost small" onClick={onClose} aria-label="Close menu">Close</button>
        </div>
        <nav className="sidebar-nav">
          <Link to="/" onClick={onClose}>Home</Link>
          {currentUser ? (
            <Link to="/create" onClick={onClose}>My Listings</Link>
          ) : (
            <Link to="/login" onClick={onClose}>My Listings</Link>
          )}
          <Link to="/howto" onClick={onClose}>How to Bid</Link>
          {currentUser ? (
            <Link to="/payment" onClick={onClose}>Payment</Link>
          ) : (
            <Link to="/login" onClick={onClose}>Payment</Link>
          )}
          {currentUser ? (
            <Link to="/profile" onClick={onClose}>Profile</Link>
          ) : (
            <Link to="/login" onClick={onClose}>Profile</Link>
          )}
        </nav>
      </aside>
    </>
  )
}
