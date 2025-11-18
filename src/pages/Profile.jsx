import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'

export default function Profile() {
  const { currentUser, profile, confirmReceived } = useAuth()
  const [myBids, setMyBids] = useState([])
  const [pending, setPending] = useState([])
  const [completed, setCompleted] = useState([])
  const [sellerStats, setSellerStats] = useState({ total_transactions: 0, successful_transactions: 0 })

  useEffect(() => {
    if (!currentUser) return
    const statsRef = ref(db, `sellerStats/${currentUser.uid}`)
    const unsubStats = onValue(statsRef, (s) => {
      const v = s.val() || { total_transactions: 0, successful_transactions: 0 }
      setSellerStats({
        total_transactions: Number(v.total_transactions || 0),
        successful_transactions: Number(v.successful_transactions || 0),
      })
    })
    const auctionsRef = ref(db, 'auctions')
    const unsubA = onValue(auctionsRef, (s) => {
      const val = s.val() || {}
      const arr = Object.entries(val).map(([k, v]) => ({ id: k, ...v }))
      const myPending = arr.filter((a) => a.status === 'pending_delivery' && a.currentBidder === currentUser.uid)
      const myCompleted = arr.filter((a) => a.status === 'completed' && a.currentBidder === currentUser.uid)
      setPending(myPending)
      setCompleted(myCompleted)
    })

    const bidsRef = ref(db, 'bids')
    const unsubB = onValue(bidsRef, (s) => {
      const val = s.val() || {}
      const all = []
      Object.entries(val).forEach(([auctionId, bidsObj]) => {
        Object.values(bidsObj || {}).forEach((b) => {
          if (b.userId === currentUser.uid) {
            all.push({ auctionId, ...b })
          }
        })
      })
      all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setMyBids(all)
    })

    return () => {
      unsubA()
      unsubB()
      unsubStats && unsubStats()
    }
  }, [currentUser])

  if (!currentUser) return <div style={{ padding: 12 }}>Please sign in to view your profile.</div>

  return (
    <div style={{ padding: 12 }}>
      <h2>Profile</h2>
      <div className="card section">
        <div><strong>Name:</strong> {profile?.displayName || currentUser.email}</div>
        <div><strong>Balance:</strong> ฿ {profile?.balance ?? 0}</div>
        <div>
          <strong>อัตราธุรกรรมสำเร็จ:</strong> {sellerStats.total_transactions > 0 ? `${Math.round((sellerStats.successful_transactions / sellerStats.total_transactions) * 100)}%` : '—'}
          {sellerStats.total_transactions > 0 ? ` • จากจำนวน ${sellerStats.total_transactions} ธุรกรรม` : ''}
        </div>
      </div>

      <section style={{ marginTop: 12 }}>
        <h3>Your bid history</h3>
        <ul>
          {myBids.map((b, i) => (
            <li key={i}>Auction: {b.auctionId} — ฿{b.amount} at {new Date(b.createdAt).toLocaleString()}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3>Pending delivery</h3>
        <div className="auctions-grid">
          {pending.map((a) => (
            <div key={a.id} className="auction-card">
              <h4>{a.title}</h4>
              {a.imageUrl && <img src={a.imageUrl} alt={a.title} />}
              <div className="muted">Final price: ฿{a.currentPrice}</div>
              <button className="btn" onClick={async () => {
                if (!confirm('ยืนยันได้รับสินค้าแล้ว? เงินจะถูกโอนไปยังผู้ขาย')) return
                try {
                  await confirmReceived(a.id)
                  alert('ยืนยันสำเร็จ — ได้ดำเนินการโอนเงินให้ผู้ขายแล้ว')
                } catch (err) {
                  alert('ยืนยันล้มเหลว: ' + err.message)
                }
              }}>Confirm received</button>
            </div>
          ))}
          {pending.length === 0 && <div>No items pending delivery.</div>}
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3>Completed purchases</h3>
        <div className="auctions-grid">
          {completed.map((a) => (
            <div key={a.id} className="auction-card">
              <h4>{a.title}</h4>
              {a.imageUrl && <img src={a.imageUrl} alt={a.title} />}
              <div className="muted">Paid: ฿{a.currentPrice}</div>
            </div>
          ))}
          {completed.length === 0 && <div>No completed purchases yet.</div>}
        </div>
      </section>
    </div>
  )
}
