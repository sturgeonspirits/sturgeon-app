import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getDailyToken } from '@/lib/checkin-token'

export default async function StaffDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  // ── Role check (3 layers) ─────────────────────────────────────
  // Layer 1: app_metadata — no DB query needed. Set with SQL:
  //   UPDATE auth.users
  //   SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
  //   WHERE email = 'your@email.com';
  const STAFF_ROLES = ['staff', 'admin']
  const appRole: string = (user as any).app_metadata?.role ?? ''

  if (!STAFF_ROLES.includes(appRole)) {
    // Layer 2 + 3: profiles table via service client
    let profileRole = ''
    try {
      const service = createServiceClient()
      const { data } = await service
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      profileRole = data?.role ?? ''

      // Layer 3: auto-insert missing profile for @sturgeonspirits.com
      if (!data && user.email?.endsWith('@sturgeonspirits.com')) {
        await service.from('profiles').upsert({
          id: user.id,
          email: user.email,
          role: 'staff',
          display_name: user.email.split('@')[0],
          full_name: user.email.split('@')[0],
        }, { onConflict: 'id' })
        profileRole = 'staff'
      }
    } catch { /* service key may not be configured */ }

    if (!STAFF_ROLES.includes(profileRole)) {
      redirect('/staff/login')
    }
  }

  // Recent member activity
  const { data: recentEvents } = await supabase
    .from('earn_events')
    .select('*, profiles(display_name)')
    .order('created_at', { ascending: false })
    .limit(10)

  // Pending redemption count for badge
  const { count: pendingCount } = await supabase
    .from('reward_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { data: profile } = await supabase.from('profiles').select('display_name, role').eq('id', user.id).single()

  const checkinToken = getDailyToken()
  const checkinUrl   = `https://club.sturgeonspirits.com/checkin?t=${checkinToken}`
  const qrImageUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkinUrl)}&format=png`

  const cards = [
    { href: '/staff/dashboard',    icon: '📊', label: 'Dashboard',       desc: 'Members, points, top lists' },
    { href: '/staff/scores',       icon: '🥃', label: 'Enter Scores',   desc: 'Cribbage & Trivia'     },
    { href: '/staff/customers',    icon: '👤', label: 'Customers',       desc: 'Add & search members'  },
    { href: '/staff/redemptions',  icon: '🎟️', label: 'Redemptions',     desc: 'Approve member requests', badge: pendingCount ?? 0 },
    { href: '/staff/rewards',      icon: '🎁', label: 'Rewards',         desc: 'Add & edit catalog'    },
    { href: '/staff/missions',     icon: '📋', label: 'Missions',        desc: 'Add & mark completions'},
    { href: '/staff/events',       icon: '📅', label: 'Events',          desc: 'Manage weekly events'  },
    { href: '/staff/menu',         icon: '🍹', label: 'Menu',            desc: 'View & sync recipes'   },
    { href: '/staff/toast-sync',   icon: '🔄', label: 'Toast Sync',      desc: 'Import loyalty points' },
  ]

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-[#242622]">Dashboard</h1>
        <p className="text-sm text-[#7E613F]">
          Welcome, {profile?.display_name ?? 'staff'} · <span className="text-[#96321F]">{profile?.role}</span>
        </p>
      </div>

      {/* Daily check-in QR */}
      <div className="bg-white border border-[#D4CFC3] rounded-2xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[#242622]">Today's Check-In QR</p>
            <p className="text-xs text-[#7E613F] mt-0.5">Show this to customers — rotates at midnight</p>
          </div>
          <Link
            href="/staff/checkin"
            className="text-xs font-semibold text-[#96321F] border border-[#96321F]/30 px-3 py-1.5 rounded-xl hover:bg-[#96321F]/5 transition-colors"
          >
            Fullscreen ↗
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImageUrl} alt="Daily check-in QR code" width={100} height={100} className="rounded-xl shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-[#9E8F7E] break-all leading-relaxed">{checkinUrl}</p>
            <p className="text-xs text-[#7E613F] mt-2">+15 pts per visit · once per day</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map(card => (
          <Link key={card.href} href={card.href}
            className="relative bg-white border border-[#D4CFC3] rounded-xl p-4 hover:border-[#96321F]/30 transition-colors">
            {/* Pending badge */}
            {'badge' in card && (card.badge ?? 0) > 0 && (
              <span className="absolute top-3 right-3 bg-[#96321F] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {card.badge}
              </span>
            )}
            <p className="text-2xl mb-2">{card.icon}</p>
            <p className="font-semibold text-[#242622] text-sm">{card.label}</p>
            <p className="text-xs text-[#7E613F] mt-0.5">{card.desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Recent Activity</h2>
        <div className="space-y-1">
          {(recentEvents ?? []).map(e => (
            <div key={e.id} className="flex items-center gap-3 py-2 border-b border-[#D4CFC3]">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#242622] truncate">{(e.profiles as any)?.display_name ?? 'Unknown'}</p>
                <p className="text-xs text-[#7E613F]">{(e.event_type ?? '').replace(/_/g, ' ')}</p>
              </div>
              <p className={`text-sm font-bold flex-shrink-0 ${e.points_delta >= 0 ? 'text-[#87A67F]' : 'text-red-500'}`}>
                {e.points_delta >= 0 ? '+' : ''}{e.points_delta} pts
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
