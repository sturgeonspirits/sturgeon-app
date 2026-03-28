import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RewardForm from '../RewardForm'

export const dynamic = 'force-dynamic'

export default async function EditRewardPage({ params }: { params: { id: string } }) {
  const service = createServiceClient()
  const { data: reward } = await service
    .from('rewards')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!reward) notFound()

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-4 mb-5">
        <h1 className="font-display text-xl font-bold text-[#242622]">Edit Reward</h1>
        <p className="text-sm text-[#7E613F] mt-0.5">{reward.name}</p>
      </div>
      <RewardForm existing={reward} />
    </div>
  )
}
