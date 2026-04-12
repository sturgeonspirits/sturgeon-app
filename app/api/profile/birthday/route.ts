import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { birthday } = body as { birthday?: string }

  // Must be MM/DD format
  if (!birthday || !/^\d{2}\/\d{2}$/.test(birthday)) {
    return NextResponse.json({ error: 'Invalid format — expected MM/DD' }, { status: 400 })
  }

  const [mm, dd] = birthday.split('/').map(Number)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('profiles')
    .update({ birthday })
    .eq('id', user.id)

  if (error) {
    console.error('[profile/birthday] update error:', error)
    return NextResponse.json({ error: 'Failed to save birthday' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
