import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
function unquote(s) { return (s || '').toString().replace(/^['"]|['"]$/g, '').trim() }
const allowedOrigins = (process.env.ALLOWED_ORIGINS || allowedOrigin)
  .split(',')
  .map(s => unquote(s))

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('Not allowed by CORS'))
  },
}))
app.use(express.json())

import omiseFactory from 'omise'
const rawKey = (process.env.OMISE_SECRET_KEY || '').toString()
  .replace(/^['"]|['"]$/g, '')
  .trim()
const omiseSecretKey = rawKey
const keyType = omiseSecretKey.startsWith('skey_') ? 'secret'
  : omiseSecretKey.startsWith('pkey_') ? 'public'
  : 'unknown'
const keyMode = omiseSecretKey.includes('_test_') ? 'test'
  : omiseSecretKey.includes('_live_') ? 'live'
  : 'unknown'
const omise = omiseFactory({ secretKey: omiseSecretKey })

function mapOmiseError(err, method) {
  const code = err?.code || 'unknown'
  const message = err?.message || 'Request failed'
  let hint
  if (code === 'authentication_failure') {
    hint = 'Authentication failed for this payment method. Secret key works (whoami succeeded), so this method is likely not enabled for your TEST account. Enable it in Omise Dashboard > Settings > Payment Methods/Capabilities or contact Omise support.'
    return { code: 'METHOD_NOT_ENABLED', message, hint, method }
  }
  return { code, message, hint, method }
}

function toSatang(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, omiseKeyLoaded: !!omiseSecretKey, keyType, keyMode })
})

app.get('/api/omise/whoami', async (_req, res) => {
  try {
    if (!omiseSecretKey) return res.status(500).json({ error: 'Missing secret key' })
    if (!omise || !omise.account || typeof omise.account.retrieve !== 'function') {
      return res.status(500).json({ error: 'Omise client missing account API' })
    }
    const acct = await omise.account.retrieve()
    res.json({ id: acct.id, email: acct.email, country: acct.country, currency: acct.currency, livemode: acct.livemode, supported_backends: acct.supported_backends || undefined, capabilities: acct.capabilities || undefined })
  } catch (err) {
    console.error('WhoAmI error:', err)
    const msg = err && err.message ? err.message : 'Auth failed'
    res.status(400).json({ error: msg })
  }
})

app.post('/api/omise/debug/source', async (req, res) => {
  try {
    if (!omiseSecretKey) return res.status(500).json({ error: 'Missing secret key' })
    if (!omise || !omise.sources || typeof omise.sources.create !== 'function') {
      return res.status(500).json({ error: 'Omise client missing sources API' })
    }
    const { amount, currency='thb' } = req.body || {}
    const satang = toSatang(amount || 20) || 2000
    const source = await omise.sources.create({ type: 'promptpay', amount: satang, currency })
    res.json({ ok: true, source })
  } catch (err) {
    console.error('Debug source error:', err)
    res.status(400).json({ error: err?.message || 'Create source failed', raw: err })
  }
})

app.post('/api/payments/create', async (req, res) => {
  try {
    const { amount, currency = 'thb', cardToken, description, metadata, uid } = req.body || {}
    const satang = toSatang(amount)
    if (!satang) return res.status(400).json({ error: 'Invalid amount' })
    if (!cardToken) return res.status(400).json({ error: 'Missing card token' })

    const idemKey = `cardtok_${cardToken}`
    try {
      const charge = await new Promise((resolve, reject) => {
        omise.charges.create({
          amount: satang,
          currency,
          card: cardToken,
          description: description || 'Auction Top-up',
          metadata: { ...(metadata||{}), uid: uid || undefined },
          capture: true,
        }, (err, result) => {
          if (err) return reject(err)
          resolve(result)
        }, { 'Idempotency-Key': idemKey })
      })
      return res.json({ id: charge.id, status: charge.status, charge })
    } catch (inner) {
      const msg = inner?.message || ''
      if (/token was already used/i.test(msg)) {
        try {
          const page = await omise.charges.list({ limit: 50, order: 'reverse_chronological' })
          const all = Array.isArray(page.data) ? page.data : page
          const satang = toSatang(amount)
          const candidates = all.filter(c =>
            c && c.metadata && c.metadata.uid === (uid || (metadata && metadata.uid)) &&
            Number(c.amount) === satang &&
            ['pending','successful'].includes(c.status)
          )
          const existing = candidates[0]
          if (existing) {
            return res.json({ id: existing.id, status: existing.status, charge: existing, recovered: true })
          }
          return res.status(409).json({ error: 'Token already used', reason: 'duplicate_token', recoverable: true })
        } catch (lookupErr) {
          console.error('Lookup after duplicate token failed:', lookupErr)
          return res.status(400).json({ error: msg || 'Charge failed' })
        }
      }
      throw inner
    }
  } catch (err) {
    console.error('Create charge error:', err)
    const msg = err && err.message ? err.message : 'Charge failed'
    res.status(400).json({ error: msg })
  }
})

app.get('/api/payments/latest', async (req, res) => {
  try {
    const { uid, amount } = req.query
    if (!uid) return res.status(400).json({ error: 'Missing uid' })
    if (!omise || !omise.charges || typeof omise.charges.list !== 'function') {
      return res.status(500).json({ error: 'Omise client missing charges API' })
    }
    const page = await omise.charges.list({ limit: 50, order: 'reverse_chronological' })
    const all = Array.isArray(page.data) ? page.data : page
    let mine = all.filter(c => c.status === 'successful' && c.metadata && c.metadata.uid === uid)
    if (amount) {
      const satang = toSatang(amount)
      if (satang) mine = mine.filter(c => Number(c.amount) === satang)
    }
    const latest = mine[0] || null
    if (!latest) return res.status(404).json({ error: 'No matching charge' })
    res.json({ id: latest.id, status: latest.status, charge: latest })
  } catch (err) {
    console.error('Latest charge error:', err)
    res.status(400).json({ error: err?.message || 'Failed latest lookup' })
  }
})

app.post('/api/payments/promptpay', async (req, res) => {
  try {
    if (!omiseSecretKey) return res.status(500).json({ error: 'Omise secret key not configured on server' })
    const { amount, currency = 'thb', description, metadata } = req.body || {}
    const satang = toSatang(amount)
    if (!satang) return res.status(400).json({ error: 'Invalid amount' })

    if (!omise || !omise.sources || typeof omise.sources.create !== 'function') {
      return res.status(500).json({ error: 'Omise client missing sources API' })
    }
    const source = await omise.sources.create({
      type: 'promptpay',
      amount: satang,
      currency,
    })

    if (!omise || !omise.charges || typeof omise.charges.create !== 'function') {
      return res.status(500).json({ error: 'Omise client missing charges API' })
    }
    const charge = await omise.charges.create({
      amount: satang,
      currency,
      source: source.id,
      description: description || 'Auction Top-up (PromptPay)',
      metadata: metadata || {},
    })

    const image = charge?.source?.scannable_code?.image
    const qr = image?.download_uri || image?.uri || null
    const expiresAt = charge?.source?.scannable_code?.expires_at || null

    res.json({ id: charge.id, status: charge.status, authorize_uri: charge.authorize_uri || null, qr, expiresAt, charge })
  } catch (err) {
    console.error('PromptPay create error:', err)
    const mapped = mapOmiseError(err, 'promptpay')
    res.status(400).json({ error: mapped.message, code: mapped.code, hint: mapped.hint })
  }
})

app.post('/api/payments/offsite', async (req, res) => {
  try {
    if (!omiseSecretKey) return res.status(500).json({ error: 'Omise secret key not configured on server' })
    const { amount, type, return_uri, currency = 'thb', description, metadata, phone_number } = req.body || {}
    const satang = toSatang(amount)
    if (!satang) return res.status(400).json({ error: 'Invalid amount' })
    if (!type) return res.status(400).json({ error: 'Missing source type' })

    const sourcePayload = { type, amount: satang, currency }
    if (type === 'truemoney') {
      sourcePayload.phone_number = phone_number || '0912345678'
    }

    if (!omise || !omise.sources || typeof omise.sources.create !== 'function') {
      return res.status(500).json({ error: 'Omise client missing sources API' })
    }
    const source = await omise.sources.create(sourcePayload)

    if (!omise || !omise.charges || typeof omise.charges.create !== 'function') {
      return res.status(500).json({ error: 'Omise client missing charges API' })
    }
    const charge = await omise.charges.create({
      amount: satang,
      currency,
      source: source.id,
      return_uri: return_uri || 'http://localhost:5173/payment',
      description: description || `Auction Top-up (${type})`,
      metadata: metadata || {},
    })

    res.json({ id: charge.id, status: charge.status, authorize_uri: charge.authorize_uri || null, charge })
  } catch (err) {
    console.error('Offsite create error:', err)
    const mapped = mapOmiseError(err, 'offsite')
    res.status(400).json({ error: mapped.message, code: mapped.code, hint: mapped.hint })
  }
})

app.get('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'Missing id' })
    if (!omise || !omise.charges || typeof omise.charges.retrieve !== 'function') {
      return res.status(500).json({ error: 'Omise client missing charges API' })
    }
    const charge = await omise.charges.retrieve(id)
    res.json({ id: charge.id, status: charge.status, charge })
  } catch (err) {
    console.error('Get charge error:', err)
    res.status(400).json({ error: 'Cannot retrieve charge' })
  }
})

app.post('/api/payments/refund', async (req, res) => {
  try {
    const { chargeId, amount, reason } = req.body || {}
    if (!chargeId) return res.status(400).json({ error: 'Missing chargeId' })
    const satang = toSatang(amount)
    if (!satang) return res.status(400).json({ error: 'Invalid amount' })

    let refund
    if (omise && omise.refunds && typeof omise.refunds.create === 'function') {
      refund = await omise.refunds.create({ charge: chargeId, amount: satang, reason: reason || 'requested_by_customer' })
    } else if (omise && omise.charges && typeof omise.charges.createRefund === 'function') {
      refund = await omise.charges.createRefund(chargeId, { amount: satang, reason: reason || 'requested_by_customer' })
    } else {
      return res.status(500).json({ error: 'Omise client missing refunds API' })
    }

    let charge
    if (omise && omise.charges && typeof omise.charges.retrieve === 'function') {
      charge = await omise.charges.retrieve(chargeId)
    }

    res.json({ ok: true, refund, charge })
  } catch (err) {
    console.error('Refund error:', err)
    const msg = err?.message || 'Refund failed'
    res.status(400).json({ error: msg, code: err?.code })
  }
})

async function listUserRefundableCharges(uid, limit = 100) {
  if (!omise || !omise.charges || typeof omise.charges.list !== 'function') {
    throw new Error('Omise client missing charges API')
  }
  const page = await omise.charges.list({ limit, order: 'reverse_chronological' })
  const all = Array.isArray(page.data) ? page.data : page
  const mine = all.filter(c => c.status === 'successful' && c.metadata && c.metadata.uid === uid)
  return mine.map(c => ({ id: c.id, amount: Number(c.amount)||0, refunded: Number(c.refunded)||0 }))
}

app.post('/api/payments/withdraw', async (req, res) => {
  try {
    const { uid, amount, reason } = req.body || {}
    if (!uid) return res.status(400).json({ error: 'Missing uid' })
    const satang = toSatang(amount)
    if (!satang) return res.status(400).json({ error: 'Invalid amount' })

    const refundable = await listUserRefundableCharges(uid, 100)
    const totalRefundable = refundable.reduce((sum, r) => sum + Math.max(0, r.amount - (r.refunded||0)), 0)
    if (totalRefundable < satang) {
      return res.status(400).json({ error: 'Amount exceeds refundable total', refundable: Math.round(totalRefundable/100) })
    }

    let remaining = satang
    const refunds = []
    for (const rec of refundable) {
      if (remaining <= 0) break
      const canRefund = Math.max(0, rec.amount - (rec.refunded||0))
      if (canRefund <= 0) continue
      const doAmt = Math.min(remaining, canRefund)

      let refund
      if (omise && omise.refunds && typeof omise.refunds.create === 'function') {
        refund = await omise.refunds.create({ charge: rec.id, amount: doAmt, reason: reason || 'requested_by_customer' })
      } else if (omise && omise.charges && typeof omise.charges.createRefund === 'function') {
        refund = await omise.charges.createRefund(rec.id, { amount: doAmt, reason: reason || 'requested_by_customer' })
      } else {
        return res.status(500).json({ error: 'Omise client missing refunds API' })
      }

      refunds.push({ chargeId: rec.id, amount: doAmt, refund })
      remaining -= doAmt
    }

    res.json({ ok: true, totalRefunded: (satang - remaining), refunds })
  } catch (err) {
    console.error('Withdraw (refund) error:', err)
    res.status(400).json({ error: err?.message || 'Withdraw failed' })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
