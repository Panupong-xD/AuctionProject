import React from 'react'
import { Link } from 'react-router-dom'

export default function AuctionCard({ auction }) {
  if (!auction) return null
  const endsIn = Math.max(0, (auction.endsAt || 0) - Date.now())
  const totalMinutes = Math.ceil(endsIn / (60 * 1000))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60)
  const minutes = totalMinutes - days * 60 * 24 - hours * 60
  const timeText = `${days}d ${hours}h ${minutes}m`

  return (
    <article className="auction-card">
      <h3>{auction.title}</h3>
      <p className="muted">{auction.description}</p>
      {auction.imageUrl && <img src={auction.imageUrl} alt={auction.title} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>฿ {auction.currentPrice}</div>
          <div className="muted">Ends in: {timeText}</div>
        </div>
        <div>
          <Link to={`/auctions/${auction.id}`} className="btn">View</Link>
        </div>
      </div>
    </article>
  )
}
