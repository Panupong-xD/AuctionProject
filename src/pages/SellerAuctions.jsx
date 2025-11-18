import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function SellerAuctions() {
  const { currentUser, cancelAuction, relistAuctionFull, deleteExpiredNoBids } = useAuth()
  const [auctions, setAuctions] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, auctionId: null })
  const [rPrice, setRPrice] = useState('')
  const [rDays, setRDays] = useState('')
  const [rHours, setRHours] = useState('')
  const [rMinutes, setRMinutes] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser) return
    const auctionsRef = ref(db, 'auctions')
    const unsub = onValue(auctionsRef, (snap) => {
      const val = snap.val() || {}
      const arr = Object.entries(val).map(([k, v]) => ({ id: k, ...v }))
      const mine = arr.filter((a) => a.ownerId === currentUser.uid)
      mine.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setAuctions(mine)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  async function handleCancel(id) {
    if (!confirm('Cancel this auction? If there are no bids it will be removed.')) return
    try {
      const res = await cancelAuction(id)
      if (res.deleted) {
        alert('Auction cancelled and removed (no bids).')
      } else {
        alert('Auction cancelled (counted as failed transaction).')
      }
    } catch (err) {
      alert('Cancel failed: ' + err.message)
    }
  }

  if (!currentUser) return <div style={{ padding: 18 }} className="section-surface">Please sign in to manage your auctions.</div>

  const openAuctions = auctions.filter((a) => a.status === 'open')
  const otherAuctions = auctions.filter((a) => a.status !== 'open')

  return (
    <div className="stack-12" style={{ padding: 12 }}>
      <div className="between section-surface soft" style={{ padding: '18px 20px' }}>
        <h2 style={{ margin: 0 }}>My Listings</h2>
        <button onClick={() => navigate('/create/new')} className="btn">ลงสินค้าประมูลใหม่</button>
      </div>

      <div className="section-surface">
        <h3>กำลังประมูล (Open)</h3>
        {loading ? <div className="muted">Loading...</div> : (
          <>
            {openAuctions.length === 0 && <div className="muted">No open auctions.</div>}
            <div className="auctions-grid">
              {openAuctions.map((a) => (
                <div key={a.id} className="auction-card">
                  <h4>{a.title}</h4>
                  {a.imageUrl && <img src={a.imageUrl} alt={a.title} />}
                  <div className="muted">Current: ฿{a.currentPrice}</div>
                  <div className="muted">Ends: {new Date(a.endsAt).toLocaleString()}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => navigate(`/auctions/${a.id}`)} className="btn small">View</button>
                    <button onClick={() => handleCancel(a.id)} className="btn small ghost">Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="section-surface">
        <h3>อื่น ๆ (Other statuses)</h3>
        {otherAuctions.length === 0 && <div className="muted">No other auctions.</div>}
        <div className="auctions-grid">
          {otherAuctions.map((a) => (
            <div key={a.id} className="auction-card">
              <h4>{a.title}</h4>
              {a.imageUrl && <img src={a.imageUrl} alt={a.title} />}
              <div className="muted">Current: ฿{a.currentPrice}</div>
              <div className="muted">Status: {a.status}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button onClick={() => navigate(`/auctions/${a.id}`)} className="btn small">View</button>
                {a.status === 'expired_no_bids' && (
                  <>
                    <button className="btn small ghost" onClick={() => setModal({ open: true, auctionId: a.id })}>Relist</button>
                    <button className="btn small danger" onClick={async () => {
                      if (!confirm('Delete this expired auction?')) return
                      try { await deleteExpiredNoBids(a.id); alert('Deleted') } catch (err) { alert('Delete failed: ' + err.message) }
                    }}>Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal.open && (
        <div className="modal-backdrop" onClick={() => setModal({ open: false, auctionId: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Relist Auction</h3>
            <div className="stack-12">
              <div className="field">
                <label>New Price</label>
                <input type="number" placeholder="เช่น 1000" value={rPrice} onChange={(e) => setRPrice(e.target.value)} />
              </div>
              <div className="field">
                <label>Duration (Days / Hours / Minutes)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" placeholder="Days" value={rDays} onChange={(e) => setRDays(e.target.value)} />
                  <input type="number" placeholder="Hours" value={rHours} onChange={(e) => setRHours(e.target.value)} />
                  <input type="number" placeholder="Minutes" value={rMinutes} onChange={(e) => setRMinutes(e.target.value)} />
                </div>
              </div>
              <div className="between" style={{ marginTop: 4 }}>
                <button className="btn secondary" onClick={() => setModal({ open: false, auctionId: null })}>Cancel</button>
                <button className="btn" onClick={async () => {
                  const p = Math.floor(Number(rPrice) || 0)
                  const d = Math.floor(Number(rDays) || 0)
                  const h = Math.floor(Number(rHours) || 0)
                  const m = Math.floor(Number(rMinutes) || 0)
                  if (!p || p <= 0) return alert('Please enter a valid price')
                  const total = d * 24 * 60 + h * 60 + m
                  if (total < 1) return alert('Please set a duration (at least 1 minute)')
                  try {
                    await relistAuctionFull(modal.auctionId, p, d, h, m)
                    alert('Relisted')
                    setModal({ open: false, auctionId: null })
                    setRPrice(''); setRDays(''); setRHours(''); setRMinutes('')
                  } catch (err) {
                    alert('Relist failed: ' + err.message)
                  }
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
