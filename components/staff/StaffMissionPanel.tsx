'use client'

import { useState } from 'react'
import type { Mission } from '@/lib/supabase/types'

type MemberOption = { id: string; display_name: string | null; full_name: string | null; phone: string | null; email: string | null }
function memberLabel(m: MemberOption) {
  const name = m.full_name ?? m.display_name ?? m.email ?? '?'
  return m.phone ? `${name} · ${m.phone}` : name
}

type PendingRequest = {
  id: string
  created_at: string
  user_id: string
  mission_id: string
  missions: { title: string; icon: string | null; points: number } | null
  profiles: { display_name: string | null; full_name: string | null; email: string | null } | null
}

interface Props {
  missions:        Mission[]
  members:         MemberOption[]
  staffId:         string
  pendingRequests: PendingRequest[]
}

function PendingRequestCard({ request, staffId, onDone }: { request: PendingRequest; staffId: string; onDone: () => void }) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [message, setMessage] = useState('')

  const mission = request.missions
  const profile = request.profiles
  const name    = profile?.display_name ?? profile?.full_name ?? profile?.email ?? 'Member'

  async function handle(action: 'approve' | 'reject') {
    setLoading(action)
    setMessage('')
    const res = await fetch('/api/staff/approve-mission-request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requestId: request.id, action }),
    })
    const json = await res.json()
    setLoading(null)
    if (res.ok) {
      setMessage(action === 'approve' ? `✓ Approved! +${json.pointsEarned} pts` : '✕ Rejected')
      setTimeout(onDone, 1000)
    } else {
      setMessage(json.error ?? 'Error')
    }
  }

  return (
    <div className="bg-white border border-[#D4CFC3] rounded-xl p-3 flex items-center gap-3">
      <span className="text-2xl flex-shrink-0">{mission?.icon ?? '🎯'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#242622] truncate">{mission?.title}</p>
        <p className="text-xs text-[#7E613F]">{name} · +{mission?.points ?? 0} pts</p>
        {message && (
          <p className={`text-xs mt-0.5 ${message.startsWith('✓') ? 'text-green-600' : message.startsWith('✕') ? 'text-[#9E8F7E]' : 'text-red-500'}`}>
            {message}
          </p>
        )}
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={() => handle('approve')}
          disabled={loading !== null}
          className="text-xs font-bold bg-[#87A67F] text-white px-3 py-1.5 rounded-lg hover:bg-[#9ab891] disabled:opacity-50 transition-colors"
        >
          {loading === 'approve' ? '…' : 'Approve'}
        </button>
        <button
          onClick={() => handle('reject')}
          disabled={loading !== null}
          className="text-xs font-bold bg-[#F1F1E7] text-[#7E613F] px-3 py-1.5 rounded-lg hover:bg-[#D4CFC3] disabled:opacity-50 transition-colors"
        >
          {loading === 'reject' ? '…' : 'Reject'}
        </button>
      </div>
    </div>
  )
}

export default function StaffMissionPanel({ missions, members, staffId, pendingRequests }: Props) {
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [selectedMember,  setSelectedMember]  = useState('')
  const [loading, setLoading]                 = useState(false)
  const [message, setMessage]                 = useState('')
  const [qrCode,  setQrCode]                  = useState<string | null>(null)
  const [requests, setRequests]               = useState<PendingRequest[]>(pendingRequests)

  const manualMissions = missions.filter(m =>
    ['manual_staff', 'qr_scan', 'event_attendance'].includes(m.completion_trigger)
  )

  async function markComplete() {
    if (!selectedMission || !selectedMember) return
    setLoading(true)
    setMessage('')

    const res = await fetch('/api/staff/complete-mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionSlug: selectedMission.slug,
        userId:      selectedMember,
        staffId,
      }),
    })
    const json = await res.json()
    setMessage(res.ok ? `✓ Mission complete! +${json.pointsEarned} pts` : json.error ?? 'Error')
    setLoading(false)
  }

  async function generateQr() {
    if (!selectedMission) return
    setLoading(true)
    const res = await fetch('/api/staff/generate-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionId: selectedMission.id, staffId }),
    })
    const json = await res.json()
    if (res.ok) setQrCode(json.qrDataUrl)
    setLoading(false)
  }

  return (
    <div className="space-y-4">

      {/* ── Pending customer requests ── */}
      {requests.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-2">
            Pending Requests ({requests.length})
          </p>
          <div className="space-y-2">
            {requests.map(r => (
              <PendingRequestCard
                key={r.id}
                request={r}
                staffId={staffId}
                onDone={() => setRequests(prev => prev.filter(x => x.id !== r.id))}
              />
            ))}
          </div>
        </section>
      )}

      {/* Mission picker */}
      <div>
        <label className="block text-xs text-[#7E613F] mb-2 uppercase tracking-widest">Mission</label>
        <div className="space-y-2">
          {manualMissions.map(m => (
            <button
              key={m.id}
              onClick={() => { setSelectedMission(m); setQrCode(null); setMessage('') }}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                selectedMission?.id === m.id
                  ? 'border-[#96321F] bg-[#96321F]/8'
                  : 'border-[#D4CFC3] bg-[#FFFFFF]'
              }`}
            >
              <span className="text-xl">{m.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#242622]">{m.title}</p>
                <p className="text-xs text-[#7E613F]">{m.completion_trigger.replace('_', ' ')} · +{m.points} pts</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedMission && (
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4 space-y-4">
          <p className="text-sm font-semibold text-[#242622]">{selectedMission.icon} {selectedMission.title}</p>

          {/* QR code generation (for qr_scan missions) */}
          {selectedMission.completion_trigger === 'qr_scan' && (
            <div className="space-y-3">
              <p className="text-xs text-[#7E613F]">Show this QR code for members to scan</p>
              {qrCode ? (
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="QR Code" className="mx-auto w-48 h-48 rounded-xl" />
                  <p className="text-xs text-[#7E613F] mt-2">Valid for 15 minutes</p>
                  <button onClick={() => setQrCode(null)} className="text-xs text-[#96321F] hover:text-[#ae3a24] mt-2 transition-colors">
                    Generate new code
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateQr}
                  disabled={loading}
                  className="w-full bg-[#96321F] text-[#FFFFFF] font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
                >
                  {loading ? 'Generating…' : '📷 Generate QR Code'}
                </button>
              )}
            </div>
          )}

          {/* Manual completion */}
          {['manual_staff', 'event_attendance'].includes(selectedMission.completion_trigger) && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#7E613F] mb-1.5 uppercase tracking-widest">Member</label>
                <select
                  value={selectedMember}
                  onChange={e => setSelectedMember(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#C8BCA4] rounded-lg px-3 min-h-[44px] text-[#242622] text-base focus:outline-none focus:border-[#96321F]"
                >
                  <option value="">Select member</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{memberLabel(m)}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={markComplete}
                disabled={!selectedMember || loading}
                className="w-full bg-[#87A67F] text-[#FFFFFF] font-semibold py-3.5 rounded-xl text-base disabled:opacity-40 hover:bg-[#9ab891] active:scale-[0.98] transition-all"
              >
                {loading ? 'Saving…' : '✓ Mark Complete'}
              </button>
            </div>
          )}

          {message && (
            <p className={`text-sm ${message.startsWith('✓') ? 'text-[#5dbb5d]' : 'text-red-500'}`}>
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
