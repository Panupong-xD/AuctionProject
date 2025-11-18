import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, query, orderByChild } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function AuctionDetail() {
  const { id } = useParams()
  const [auction, setAuction] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [bids, setBids] = useState([])
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const { placeBid, profile, currentUser, cancelAuction, processEndedAuctions } = useAuth()

  useEffect(() => {
    if (!id) return
    const auctionRef = ref(db, `auctions/${id}`)
    const unsubA = onValue(auctionRef, (s) => {
      setAuction(s.val())
      setLoaded(true)
    })

    const bidsRef = query(ref(db, `bids/${id}`), orderByChild('createdAt'))
    const unsubB = onValue(bidsRef, (s) => {
      const val = s.val() || {}
      const arr = Object.values(val)
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setBids(arr)
    })

    return () => {
      unsubA()
      unsubB()
    }
  }, [id])

  const [bidderName, setBidderName] = useState(null)
  useEffect(() => {
    if (!auction || !auction.currentBidder) {
      setBidderName(null)
      return
    }
    const bidderRef = ref(db, `users/${auction.currentBidder}`)
    const unsub = onValue(bidderRef, (s) => {
      const v = s.val()
      setBidderName(v?.displayName || null)
    })
    return unsub
  }, [auction?.currentBidder])

  const [sellerName, setSellerName] = useState(null)
  const [successRate, setSuccessRate] = useState(null)
  const [sellerTxTotal, setSellerTxTotal] = useState(0)
  useEffect(() => {
    if (!auction || !auction.ownerId) return
    const sellerRef = ref(db, `users/${auction.ownerId}`)
    const unsub = onValue(sellerRef, (s) => {
      const v = s.val()
      setSellerName(v?.displayName || null)
    })

    const statsRef = ref(db, `sellerStats/${auction.ownerId}`)
    const unsubStats = onValue(statsRef, (s) => {
      const v = s.val() || { total_transactions: 0, successful_transactions: 0 }
      const total = Number(v.total_transactions || 0)
      const success = Number(v.successful_transactions || 0)
      setSellerTxTotal(total)
      if (total === 0) setSuccessRate(null)
      else setSuccessRate(Math.round((success / total) * 100))
    })

    return () => { unsub(); unsubStats && unsubStats() }
  }, [auction?.ownerId])

  useEffect(() => { processEndedAuctions && processEndedAuctions() }, [processEndedAuctions])

  const [secondsLeft, setSecondsLeft] = useState(null)
  useEffect(() => {
    function tick() {
      const left = Math.max(0, Math.floor(((auction?.endsAt || 0) - Date.now()) / 1000))
      setSecondsLeft(left)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [auction?.endsAt])
  const hh = secondsLeft != null ? String(Math.floor(secondsLeft / 3600)).padStart(2, '0') : '00'
  const mm = secondsLeft != null ? String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0') : '00'
  const ss = secondsLeft != null ? String(secondsLeft % 60).padStart(2, '0') : '00'

  async function handleBid(e) {
    e.preventDefault()
    setError('')
    if (!currentUser) {
      setError('Please sign in to place bids')
      return
    }
    if (ended) {
      setError('Auction has ended and cannot accept bids')
      return
    }
    const num = Number(amount)
    if (!auction) return
    if (!num || num <= (auction.currentPrice || auction.startPrice || 0)) {
      setError('Bid must be higher than current price')
      return
    }
    if ((profile?.balance || 0) < num) {
      setError('Insufficient balance. Please top-up before bidding.')
      return
    }
    try {
      await placeBid(id, num)
      setAmount('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (!loaded) return <div style={{ padding: 12 }}>Loading...</div>
  if (!auction) return <div style={{ padding: 12 }}>Auction not found.</div>

  const ended = Date.now() > (auction.endsAt || 0)

  return (
    <div style={{ padding: 12 }}>
      <h2>{auction.title}</h2>
      {auction.imageUrl && <img src={auction.imageUrl} alt={auction.title} style={{ maxWidth: 420, borderRadius: 8 }} />}
      <p className="muted">{auction.description}</p>

  <div className="muted">Seller: {sellerName || auction.ownerId} {successRate !== null ? `• อัตราธุรกรรมสำเร็จ ${successRate}% จากจำนวน ${sellerTxTotal} ธุรกรรม` : ''}</div>

  <div className="card section" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>฿ {auction.currentPrice}</div>
            <div className="muted">Current highest bidder: {bidderName || auction.currentBidder || '—'}</div>
          </div>
          <div className="muted">Ends at: {new Date(auction.endsAt).toLocaleString()} {secondsLeft != null ? `(${hh}:${mm}:${ss})` : ''}</div>
        </div>
        {ended && <div className="error" style={{ marginTop: 8 }}>This auction has ended.</div>}
        {currentUser && currentUser.uid === auction.ownerId && (
          <div style={{ marginTop: 8 }}>
            <button className="btn small" onClick={async () => {
              if (!confirm('Cancel this auction?')) return
              try {
                  const res = await cancelAuction(id)
                alert('Cancelled')
              } catch (err) {
                alert('Cancel failed: ' + err.message)
              }
            }}>Cancel auction</button>
          </div>
        )}
      </div>

      <section className="card section" style={{ marginTop: 12 }}>
        <h3>Place a bid</h3>
        {error && <div className="error">{error}</div>}
        {!currentUser ? (
          <div>
            <p>You must <a href="/login">sign in</a> to place bids.</p>
            <button onClick={() => (window.location.href = '/login')}>Go to Sign in</button>
          </div>
        ) : currentUser.uid === auction.ownerId ? (
          <div>
            <p>You are the owner of this auction and cannot bid on it.</p>
          </div>
        ) : (
          <form onSubmit={handleBid} className="form-inline">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Your bid" type="number" step="1" />
            <button type="submit">Bid</button>
          </form>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Bid history</h3>
        <ul>
          {bids.map((b, i) => (
            <li key={i}>{b.userId}: {b.amount} at {new Date(b.createdAt).toLocaleString()}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
