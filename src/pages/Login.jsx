import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

import '../App.css'

export default function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (isRegister) {
        await signUp(email, password, displayName)
      } else {
        await signIn(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleGoogle() {
    setError('')
    try {
      await signInWithGoogle()
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>{isRegister ? 'Register' : 'Sign in'}</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
        {isRegister && (
          <input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        )}
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">{isRegister ? 'Register' : 'Sign in'}</button>
      </form>
      <div style={{ marginTop: 12, maxWidth: 400 }}>
        <div style={{ textAlign: 'center', margin: '8px 0' }}>or</div>
        <button onClick={handleGoogle} className="btn" style={{ width: '100%' }}>Sign in with Google</button>
      </div>
      <button onClick={() => setIsRegister(!isRegister)} style={{ marginTop: 12 }}>
        {isRegister ? 'Have an account? Sign in' : 'No account? Register'}
      </button>
    </div>
  )
}
