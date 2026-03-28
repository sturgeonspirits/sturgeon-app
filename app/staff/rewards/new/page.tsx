import RewardForm from '../RewardForm'

export default function NewRewardPage() {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-4 mb-5">
        <h1 className="font-display text-xl font-bold text-[#242622]">New Reward</h1>
        <p className="text-sm text-[#7E613F] mt-0.5">Create a redeemable reward for members</p>
      </div>
      <RewardForm existing={null} />
    </div>
  )
}
