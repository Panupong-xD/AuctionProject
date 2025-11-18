import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import {
  ref,
  set,
  onValue,
  push,
  update,
  runTransaction,
  get,
} from 'firebase/database'

const AUCTION_EXTENSION_MS = 60 * 1000

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (!user) {
        setProfile(null)
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!currentUser) return
    const userRef = ref(db, `users/${currentUser.uid}`)
    const off = onValue(userRef, (snap) => {
      setProfile(snap.val())
      setLoading(false)
    })
    return () => {
      off && off()
    }
  }, [currentUser])

  async function signUp(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }
    await set(ref(db, `users/${cred.user.uid}`), {
      uid: cred.user.uid,
      displayName: displayName || cred.user.email,
      balance: 0,
      createdAt: Date.now(),
    })
    return cred.user
  }

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    const cred = await signInWithPopup(auth, provider)
    const user = cred.user
    const userRef = ref(db, `users/${user.uid}`)
    const snapshot = await get(userRef)
    if (!snapshot.exists()) {
      await set(userRef, {
        uid: user.uid,
        displayName: user.displayName || user.email,
        balance: 0,
        createdAt: Date.now(),
      })
    }
    return user
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  async function topUp(amount, paymentCode) {
    if (!currentUser) throw new Error('Not authenticated')
    const userRef = ref(db, `users/${currentUser.uid}`)
    await runTransaction(userRef, (current) => {
      if (current === null) return current
      const add = Math.floor(Number(amount) || 0)
      return { ...current, balance: (current.balance || 0) + add }
    })
  }

  async function createAuction({ title, description, imageUrl, startPrice, durationMinutes }) {
    if (!currentUser) throw new Error('Not authenticated')
    const auctionsRef = ref(db, 'auctions')
    const newAuctionRef = push(auctionsRef)
    const now = Date.now()
    const endsAt = now + (durationMinutes || 60) * 60 * 1000
    await set(newAuctionRef, {
      id: newAuctionRef.key,
      title,
      description,
      imageUrl: imageUrl || '',
      startPrice: Math.floor(Number(startPrice) || 0),
      currentPrice: Math.floor(Number(startPrice) || 0),
      currentBidder: null,
      ownerId: currentUser.uid,
      createdAt: now,
      endsAt,
      status: 'open',
    })
    return newAuctionRef.key
  }

  async function placeBid(auctionId, amount) {
    if (!currentUser) throw new Error('Not authenticated')
    const auctionRef = ref(db, `auctions/${auctionId}`)
    const bidRef = ref(db, `bids/${auctionId}`)

    const result = await runTransaction(auctionRef, (current) => {
      if (!current) return current
      const currentPrice = current.currentPrice || current.startPrice || 0
      if (Date.now() > (current.endsAt || 0)) {
        return current
      }
      if (current.ownerId === currentUser.uid) return current
      const intAmount = Math.floor(Number(amount))
      if (!intAmount || intAmount <= Number(currentPrice)) {
        return current
      }
      current.currentPrice = intAmount
      current.currentBidder = currentUser.uid
      const left = (current.endsAt || 0) - Date.now()
      if (left <= AUCTION_EXTENSION_MS) {
        current.endsAt = Date.now() + AUCTION_EXTENSION_MS
      }
      return current
    })

    if (!result.committed) {
      throw new Error('Bid failed: too low or auction closed')
    }

    await push(bidRef, {
      userId: currentUser.uid,
      amount: Math.floor(Number(amount)),
      createdAt: Date.now(),
    })
  }

  async function cancelAuction(auctionId) {
    if (!currentUser) throw new Error('Not authenticated')
    const auctionRef = ref(db, `auctions/${auctionId}`)
    const auctionSnap = await get(auctionRef)
    const auction = auctionSnap.val()
    if (!auction) throw new Error('Auction not found')
    if (auction.ownerId !== currentUser.uid) throw new Error('Only owner can cancel')

    const bidsSnap = await get(ref(db, `bids/${auctionId}`))
    const bids = bidsSnap.val() || {}
    const anyBidGreater = Object.values(bids).some((b) => Number(b.amount) > Number(auction.startPrice || 0))

    if (!anyBidGreater) {
      await set(auctionRef, null)
      await set(ref(db, `bids/${auctionId}`), null)
      return { cancelled: true, deleted: true }
    }
    await update(auctionRef, { status: 'cancelled' })
    const statsRef = ref(db, `sellerStats/${currentUser.uid}`)
    await runTransaction(statsRef, (cur) => {
      const total = (cur?.total_transactions || 0) + 1
      const successful = cur?.successful_transactions || 0
      return { total_transactions: total, successful_transactions: successful }
    })
    return { cancelled: true, deleted: false }
  }

  async function getReservedAmount(userId) {
    const uid = userId || currentUser?.uid
    if (!uid) return 0
    const snap = await get(ref(db, 'reservations'))
    const val = snap.val() || {}
    let sum = 0
    Object.values(val).forEach((r) => {
      if (r && r.buyerId === uid) sum += Math.floor(Number(r.amount) || 0)
    })
    return sum
  }

  async function withdraw(amount) {
    if (!currentUser) throw new Error('Not authenticated')
    const amt = Math.floor(Number(amount) || 0)
    if (amt <= 0) throw new Error('Invalid amount')
    const reserved = await getReservedAmount(currentUser.uid)
    const userRef = ref(db, `users/${currentUser.uid}`)
    let ok = false
    await runTransaction(userRef, (cur) => {
      if (!cur) return cur
      const bal = Math.floor(Number(cur.balance) || 0)
      if (bal - amt < reserved) {
        ok = false
        return cur
      }
      ok = true
      return { ...cur, balance: bal - amt }
    })
    if (!ok) throw new Error('Withdrawal exceeds available balance')
  }

  async function processEndedAuctions() {
    const snap = await get(ref(db, 'auctions'))
    const val = snap.val() || {}
    const updates = {}
    Object.entries(val).forEach(([aid, a]) => {
      if (!a || a.status !== 'open') return
      if (Date.now() > (a.endsAt || 0)) {
        if (a.currentBidder) {
          updates[`auctions/${aid}/status`] = 'pending_delivery'
          updates[`reservations/${aid}`] = { buyerId: a.currentBidder, amount: Math.floor(Number(a.currentPrice) || 0) }
        } else {
          updates[`auctions/${aid}/status`] = 'expired_no_bids'
        }
      }
    })
    if (Object.keys(updates).length) await update(ref(db), updates)
  }

  async function confirmReceived(auctionId) {
    if (!currentUser) throw new Error('Not authenticated')
    const aSnap = await get(ref(db, `auctions/${auctionId}`))
    const a = aSnap.val()
    if (!a) throw new Error('Auction not found')
    if (a.status !== 'pending_delivery') throw new Error('Not pending delivery')
    if (a.currentBidder !== currentUser.uid) throw new Error('Only winner can confirm')
    const rSnap = await get(ref(db, `reservations/${auctionId}`))
    const r = rSnap.val()
    if (!r) throw new Error('Reservation not found')
    const amount = Math.floor(Number(r.amount) || 0)
    const buyerRef = ref(db, `users/${a.currentBidder}`)
    const sellerRef = ref(db, `users/${a.ownerId}`)
    await runTransaction(buyerRef, (cur) => {
      if (!cur) return cur
      const bal = Math.floor(Number(cur.balance) || 0)
      return { ...cur, balance: bal - amount }
    })
    await runTransaction(sellerRef, (cur) => {
      if (!cur) return cur
      const bal = Math.floor(Number(cur.balance) || 0)
      return { ...cur, balance: bal + amount }
    })
    await update(ref(db), {
      [`auctions/${auctionId}/status`]: 'completed',
      [`reservations/${auctionId}`]: null,
    })
    const statsRef = ref(db, `sellerStats/${a.ownerId}`)
    await runTransaction(statsRef, (cur) => {
      const total = (cur?.total_transactions || 0) + 1
      const successful = (cur?.successful_transactions || 0) + 1
      return { total_transactions: total, successful_transactions: successful }
    })
  }

  async function relistAuction(auctionId, newPrice, durationHours) {
    if (!currentUser) throw new Error('Not authenticated')
    const aRef = ref(db, `auctions/${auctionId}`)
    const aSnap = await get(aRef)
    const a = aSnap.val()
    if (!a) throw new Error('Auction not found')
    if (a.ownerId !== currentUser.uid) throw new Error('Only owner can relist')
    if (a.status !== 'expired_no_bids') throw new Error('Only expired_no_bids can be relisted')
    const now = Date.now()
    const durMs = Math.floor(Number(durationHours) || 1) * 60 * 60 * 1000
    const price = Math.floor(Number(newPrice) || 0)
    await update(aRef, {
      status: 'open',
      startPrice: price,
      currentPrice: price,
      currentBidder: null,
      createdAt: now,
      endsAt: now + durMs,
    })
  }

  async function relistAuctionFull(auctionId, newPrice, d, h, m) {
    if (!currentUser) throw new Error('Not authenticated')
    const aRef = ref(db, `auctions/${auctionId}`)
    const aSnap = await get(aRef)
    const a = aSnap.val()
    if (!a) throw new Error('Auction not found')
    if (a.ownerId !== currentUser.uid) throw new Error('Only owner can relist')
    if (a.status !== 'expired_no_bids') throw new Error('Only expired_no_bids can be relisted')
    const now = Date.now()
    const totalMinutes = Math.max(1, (Math.floor(Number(d)) || 0) * 24 * 60 + (Math.floor(Number(h)) || 0) * 60 + (Math.floor(Number(m)) || 0))
    const durMs = totalMinutes * 60 * 1000
    const price = Math.floor(Number(newPrice) || 0)
    await update(aRef, {
      status: 'open',
      startPrice: price,
      currentPrice: price,
      currentBidder: null,
      createdAt: now,
      endsAt: now + durMs,
    })
  }

  async function deleteExpiredNoBids(auctionId) {
    if (!currentUser) throw new Error('Not authenticated')
    const aRef = ref(db, `auctions/${auctionId}`)
    const aSnap = await get(aRef)
    const a = aSnap.val()
    if (!a) return
    if (a.ownerId !== currentUser.uid) throw new Error('Only owner can delete')
    if (a.status !== 'expired_no_bids') throw new Error('Only expired_no_bids can be deleted')
    await set(aRef, null)
    await set(ref(db, `bids/${auctionId}`), null)
  }

  const value = {
    currentUser,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
    topUp,
    createAuction,
    placeBid,
    cancelAuction,
    getReservedAmount,
    withdraw,
    processEndedAuctions,
    confirmReceived,
    relistAuction,
  relistAuctionFull,
    deleteExpiredNoBids,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
