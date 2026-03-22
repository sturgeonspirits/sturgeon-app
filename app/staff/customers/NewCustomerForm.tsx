'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCustomerForm() {
  const router = useRouter()

  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [sendInvite, setSendInvite] = useState(true)

  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/staff/customer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fullName, email, phone: phone || null, sendInvite }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create customer')
      setSuccess(`${fullName || email} was added successfully${sendInvite ? ' — invite email sent' : ''}.`)
      setFullName('')
      setEmail('')
      setPhone('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-sm text-[#242622] bg-[#FFFFFF] focus:outline-none focus:border-[#96321F] transition-colors"
  const labelCls = "block text-xs font-semibold text-[#7E613F] uppercase tracking-wide mb-1.5"

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div>
        <label className={labelCls}>Full Name</label>
        <input
          required
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Jane Smith"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Email Address</label>
        <input
          required
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="jane@example.com"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Phone <span className="font-normal text-[#9E8F7E] normal-case tracking-normal">(optional)</span></label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="(920) 555-1234"
          className={inputCls}
        />
      </div>

      {/* Send invite toggle */}
      <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setSendInvite(!sendInvite)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${sendInvite ? 'bg-[#87A67F]' : 'bg-[#D4CFC3]'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sendInvite ? 'translate-x-5' : ''}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#242622]">Send invite email</p>
            <p className="text-xs text-[#7E613F] mt-0.5">
              Customer receives a magic-link to sign into the Spearers Club app
            </p>
          </div>
        </label>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Success */}
      {success && (
        <div className="bg-[#87A67F]/10 border border-[#87A67F]/30 rounded-xl px-4 py-3">
          <p className="text-sm text-[#5a7a54] font-semibold">✓ {success}</p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-xs text-[#5a7a54] underline mt-1"
          >
            Add another customer
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#96321F] text-[#FFFFFF] font-bold py-3 rounded-xl hover:bg-[#ae3a24] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Adding…' : 'Add Customer'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/staff/customers')}
          className="px-5 py-3 rounded-xl bg-[#EDE9DC] text-[#7E613F] font-semibold hover:bg-[#D4CFC3] transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
