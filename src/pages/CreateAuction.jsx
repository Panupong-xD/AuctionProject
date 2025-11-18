import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function CreateAuction() {
  const { createAuction } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [startPrice, setStartPrice] = useState(0)
  const [days, setDays] = useState(0)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const navigate = useNavigate()

  function handleFileChange(e) {
    const f = e.target.files[0]
    setFile(f)
    if (f) setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      let imageUrl = ''
      if (file) {
        setUploading(true)
        const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
        const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        if (!CLOUD_NAME || !UPLOAD_PRESET) {
          throw new Error('Missing Cloudinary env: set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET')
        }
        const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
        const fd = new FormData()
        fd.append('file', file)
        fd.append('upload_preset', UPLOAD_PRESET)
        fd.append('folder', 'auctions')
        fd.append('public_id', `${Date.now()}_${file.name}`)
        const res = await fetch(url, { method: 'POST', body: fd })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error('Cloudinary upload failed: ' + (txt || res.status))
        }
        const data = await res.json()
        imageUrl = data.secure_url || data.url
      }

  const totalMinutes = Math.max(1, (Number(days) * 24 * 60) + (Number(hours) * 60) + Number(minutes))
  const id = await createAuction({ title, description, imageUrl, startPrice, durationMinutes: totalMinutes })
      navigate(`/auctions/${id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <h2>Create Auction</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 600 }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label>Image</label>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {preview && <img src={preview} alt="preview" style={{ maxWidth: 240, borderRadius: 6 }} />}
        <div> Starting Price </div>
        <input placeholder="Start price" type="number" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} />
        <div> Duration ( Days | Hours | Minutes )</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Days" type="number" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 90 }} />
          <input placeholder="Hours" type="number" value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: 90 }} />
          <input placeholder="Minutes" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} style={{ width: 90 }} />
        </div>
        <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Create'}</button>
      </form>
    </div>
  )
}
