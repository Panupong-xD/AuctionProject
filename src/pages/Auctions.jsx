import React, { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'
import AuctionCard from '../components/AuctionCard'

export default function Auctions() {
  const [auctions, setAuctions] = useState([])

  useEffect(() => {
    const auctionsRef = ref(db, 'auctions')
    const unsub = onValue(auctionsRef, (snap) => {
      const val = snap.val() || {}
      const arr = Object.entries(val).map(([key, v]) => ({ id: key, ...v }))
      const open = arr.filter((a) => (a.endsAt || 0) > Date.now() && (a.status || 'open') === 'open')
      open.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setAuctions(open)
    })
    return unsub
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <h2>Auctions</h2>
      <div className="auctions-grid">
        {auctions.map((a) => (
          <AuctionCard key={a.id} auction={a} />
        ))}
      </div>
    </div>
  )
}
