import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'

const TERMINAL = ['successful', 'failed', 'expired', 'reversed']

export default function Payment() {
  const { topUp, profile, withdraw, getReservedAmount } = useAuth()
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState(null)
  const [chargeId, setChargeId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [credited, setCredited] = useState(false)
  const [creditedId, setCreditedId] = useState(null)
  const [reserved, setReserved] = useState(0)
  const [wAmount, setWAmount] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardName] = useState('TEST USER')
  const [cardExp, setCardExp] = useState('')
  const [cvc, setCvc] = useState('')

  const onlyDigits = (s='') => (s.match(/\d/g) || []).join('')
  const formatCardNumber = (raw='') => {
    const digits = onlyDigits(raw).slice(0,19)
    return digits.replace(/(.{4})/g,'$1 ').trim()
  }
  const luhnCheck = (num) => {
    const arr = onlyDigits(num)
    if (arr.length < 13) return false
    let sum = 0, dbl = false
    for (let i = arr.length - 1; i >= 0; i--) {
      let d = parseInt(arr[i],10)
      if (dbl) { d *= 2; if (d>9) d-=9 }
      sum += d; dbl = !dbl
    }
    return sum % 10 === 0
  }
  const formatExp = (val='') => {
    const d = onlyDigits(val).slice(0,4)
    if (d.length <= 2) return d
    return d.slice(0,2)+'/'+d.slice(2)
  }
  const parseExp = (val='') => {
    const parts = val.split('/')
    if (parts.length!==2) return { month:NaN, year:NaN }
    const mm = parseInt(parts[0],10)
    const yy = parseInt(parts[1],10)
    const fullYear = isNaN(yy) ? NaN : (2000 + yy)
    return { month:mm, year:fullYear }
  }
  const isFutureExp = (mm, yyyy) => {
    if (!mm || !yyyy) return false
    if (mm<1 || mm>12) return false
    const now = new Date()
    const exp = new Date(yyyy, mm-1, 1)
    exp.setMonth(exp.getMonth()+1); exp.setDate(0)
    return exp >= new Date(now.getFullYear(), now.getMonth(), 1)
  }

  useEffect(() => {
    async function load() {
      try {
        if (getReservedAmount) {
          const r = await getReservedAmount()
          setReserved(r)
        }
      } catch (e) { console.error(e) }
    }
    load()
  }, [getReservedAmount])

  useEffect(() => {
    if (window.OmiseCard) return
    const script = document.createElement('script')
    script.src = 'https://cdn.omise.co/omise.js'
    script.async = true
    script.onload = () => {}
    document.body.appendChild(script)
  }, [])

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

  const resetFlow = () => {
    setStatus(null)
    setChargeId(null)
    setCredited(false)
    setCreditedId(null)
    setMessage('')
  }

  const createCardTokenAndCharge = useCallback(async () => {
    if (loading) { setMessage('มีรายการชำระเงินกำลังดำเนินการ'); return }
    if (chargeId && (!status || !TERMINAL.includes(status))) {
      setMessage('มีรายการชำระเงินกำลังดำเนินการ')
      return
    }
    if (status && TERMINAL.includes(status)) {
      resetFlow()
    }
    const pk = (import.meta.env.VITE_OMISE_PUBLIC_KEY || '').toString().replace(/^[']|[']$/g, '').trim()
    if (!window.Omise) {
      setMessage('Omise JS SDK not loaded')
      return
    }
    if (!pk || !pk.startsWith('pkey_')) {
      setMessage('Invalid public key')
      return
    }
  const amt = Number(amount)
  if (!amt || amt <= 0) { setMessage('กรอกจำนวนเงิน'); return }
  const digits = onlyDigits(cardNumber)
  const { month, year } = parseExp(cardExp)
  if (!luhnCheck(digits)) { setMessage('เลขบัตรไม่ถูกต้อง'); return }
  if (!isFutureExp(month, year)) { setMessage('วันหมดอายุไม่ถูกต้อง'); return }
  if (!/^\d{3,4}$/.test(cvc)) { setMessage('CVC ไม่ถูกต้อง'); return }
    setLoading(true)
    setMessage('สร้างโทเค็นบัตร...')
    try {
      window.Omise.setPublicKey(pk)
      const tokenResponse = await new Promise((resolve, reject) => {
        window.Omise.createToken('card', {
          name: cardName,
          number: digits,
          expiration_month: month,
          expiration_year: year,
          security_code: cvc,
        }, (statusCode, response) => {
          if (statusCode === 200) resolve(response)
          else reject(response)
        })
      })
      const token = tokenResponse.id
      setMessage('กำลังสร้างรายการชำระเงิน...')
      const res = await fetch(`${API_BASE}/api/payments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), cardToken: token, description: 'Auction wallet top-up', uid: profile?.uid })
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.reason === 'duplicate_token' || /already used/i.test(data?.error||'')) {
          setMessage('โทเค็นถูกใช้ไปแล้ว กำลังค้นหารายการเดิม...')
          try {
            const latestRes = await fetch(`${API_BASE}/api/payments/latest?uid=${encodeURIComponent(profile?.uid||'')}&amount=${encodeURIComponent(amount)}`)
            const latestData = await latestRes.json()
            if (latestRes.ok) {
              setChargeId(latestData.id)
              setStatus(latestData.status)
              setMessage('เชื่อมต่อกับรายการที่มีอยู่แล้ว กำลังติดตามสถานะ...')
              return
            }
          } catch (recoverErr) {
            console.error('Recovery lookup failed', recoverErr)
          }
        }
        throw new Error(data.error || 'Charge failed')
      }
      setChargeId(data.id)
      setStatus(data.status)
      setMessage('สร้างรายการสำเร็จ กำลังติดตามสถานะ...')
    } catch (err) {
      const msg = err?.message || err?.object || err?.message_to_purchaser || 'Tokenization/Charge failed'
      setMessage(typeof msg === 'string' ? msg : 'ชำระเงินล้มเหลว')
      setLoading(false)
    }
  }, [amount, cardNumber, cardName, cardExp, cvc])

  useEffect(() => {
    if (!chargeId) return
    let int = null
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/payments/${chargeId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed status check')
        setStatus(data.status)
        if (TERMINAL.includes(data.status)) {
          clearInterval(int)
          setLoading(false)
          if (data.status === 'successful') {
            if (creditedId !== chargeId) {
              try {
                await topUp(Number(amount), 'OMISE:' + chargeId)
                setCredited(true)
                setCreditedId(chargeId)
                setMessage('Payment successful and wallet credited.')
              } catch (e) {
                setMessage('Payment succeeded but crediting failed: ' + e.message)
              }
            } else {
              setMessage('Payment successful.')
            }
          } else {
            setMessage('Payment not successful: ' + data.status)
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    int = setInterval(poll, 3000)
    poll()
    return () => clearInterval(int)
  }, [chargeId, creditedId, API_BASE])

  async function handleCreditWallet() {
    if (credited) return
    const amt = Number(amount)
    if (!amt || status !== 'successful') return
    try {
      await topUp(amt, 'OMISE:' + chargeId)
      setCredited(true)
      setMessage('Wallet credited successfully.')
    } catch (e) {
      setMessage('Credit failed: ' + e.message)
    }
  }

  const publicKey = (import.meta.env.VITE_OMISE_PUBLIC_KEY || '').toString().replace(/^['"]|['"]$/g, '').trim()
  const validation = useMemo(()=>{
    const amt = Number(amount)
    const digits = onlyDigits(cardNumber)
    const { month, year } = parseExp(cardExp)
    return {
      amountOk: !!amt && amt>0,
      numberOk: luhnCheck(digits) && digits.length === 16,
      nameOk: true,
      expOk: isFutureExp(month, year),
      cvcOk: /^\d{3,4}$/.test(cvc)
    }
  }, [amount, cardNumber, cardName, cardExp, cvc])
  const disabled = loading || !publicKey || !publicKey.startsWith('pkey_') || !validation.amountOk || !validation.numberOk || !validation.nameOk || !validation.expOk || !validation.cvcOk

  return (
    <div style={{ padding:16, maxWidth:800 }}>
      <h2>Payment</h2>
  <div className='surface-grid two-col'>
        <div className='section-surface'>
          <h3>Card Payment (Omise Test)</h3>

          <div className='card section'>
            <div className='field'>
              <label>Amount (THB)</label>
              <input type='number' min='1' placeholder='Amount' value={amount} onChange={e=>setAmount(e.target.value)} />
            </div>

            <div className='stack-12'>
                <p className='muted' style={{ fontSize:12 }}>Omise test card payment. กรอกข้อมูลบัตรทดสอบหลังเปิดฟอร์ม.</p>
                {!publicKey && <div className='error' style={{ fontSize:12 }}>Missing VITE_OMISE_PUBLIC_KEY in .env. Payment disabled.</div>}
                {!publicKey.startsWith('pkey_') && publicKey && (
                  <div className='error' style={{ fontSize:12 }}>Public key looks invalid: {publicKey}</div>
                )}
                <div className='grid' style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div className='field' style={{ gridColumn:'1 / span 2' }}>
                    <label>Card Number</label>
                    <input
                      inputMode='numeric'
                      autoComplete='cc-number'
                      placeholder='4242 4242 4242 4242'
                      value={cardNumber}
                      onChange={e=>setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={23}
                    />
                    {!validation.numberOk && cardNumber && <div className='error' style={{ fontSize:12 }}>เลขบัตรไม่ถูกต้อง</div>}
                  </div>
                  <div className='field'>
                    <label>Expiry (MM/YY)</label>
                    <input
                      inputMode='numeric'
                      autoComplete='cc-exp'
                      placeholder='12/29'
                      value={cardExp}
                      onChange={e=>setCardExp(formatExp(e.target.value))}
                      maxLength={5}
                    />
                    {!validation.expOk && cardExp && <div className='error' style={{ fontSize:12 }}>วันหมดอายุไม่ถูกต้อง</div>}
                  </div>
                  <div className='field'>
                    <label>CVC</label>
                    <input
                      inputMode='numeric'
                      autoComplete='cc-csc'
                      placeholder='123'
                      value={cvc}
                      onChange={e=>setCvc(onlyDigits(e.target.value).slice(0,4))}
                      maxLength={4}
                    />
                    {!validation.cvcOk && cvc && <div className='error' style={{ fontSize:12 }}>CVC ไม่ถูกต้อง</div>}
                  </div>
                </div>
                <button disabled={disabled} onClick={createCardTokenAndCharge}>Pay Now</button>
                <div className='muted' style={{ fontSize:12 }}>ทดสอบด้วย: 4242 4242 4242 4242 | 12/29 | 123 | TEST</div>
                {chargeId && (
                  <div className='card section'>
                    <div><strong>Charge ID:</strong> {chargeId}</div>
                    <div><strong>Status:</strong> {status || 'pending'}</div>
                    {credited && <div className='success'>Wallet credited ✓</div>}
                  </div>
                )}
                {message && <div style={{ fontSize:12 }}>{message}</div>}
              </div>
          </div>
        </div>

        <div className='section-surface soft'>
          <h3>Wallet</h3>
          <div className='stack-8'>
            <div className='card section inline'>
              <div>Balance</div>
              <div>฿ {Math.floor(Number(profile?.balance)||0)}</div>
            </div>
            <div className='card section inline'>
              <div>Reserved (holds)</div>
              <div>฿ {reserved}</div>
            </div>
            <div className='card section inline'>
              <div>Available</div>
              <div>฿ {Math.max(0, Math.floor(Number(profile?.balance)||0) - reserved)}</div>
            </div>
          </div>

          <div className='card section' style={{ marginTop:16 }}>
            <h4>Withdraw (Refund to Card)</h4>
            <div className='field'>
              <label>Amount</label>
              <input placeholder='Amount' value={wAmount} onChange={e=>setWAmount(e.target.value)} />
            </div>
            <button className='btn secondary' onClick={async()=>{
              const num = Math.floor(Number(wAmount))
              setMessage('')
              if (!num || num<=0) { setMessage('Enter a valid withdrawal amount'); return }
              const bal = Math.floor(Number(profile?.balance)||0)
              const available = Math.max(0, bal - reserved)
              if (num > available) { setMessage(`ถอนได้สูงสุด ฿${available} เท่านั้น`); return }
              try {
                const res = await fetch(`${API_BASE}/api/payments/withdraw`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ uid: profile?.uid, amount: num, reason: 'requested_by_customer' })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data?.error || 'Refund failed')
                await withdraw(num)
                setWAmount('')
                setMessage('Withdrawal successful (refund created)')
                if (getReservedAmount) {
                  const r = await getReservedAmount(); setReserved(r)
                }
              } catch (e) {
                setMessage(e.message)
              }
            }}>Withdraw</button>
            <div className='muted' style={{ fontSize:12, marginTop:6 }}>
              การถอนเงินจะทำ Refund กลับไปยังบัตรของคุณ โดยจะถอนได้ไม่เกิน Available เท่านั้น (Reserved ถูกกันไว้ชั่วคราว)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
