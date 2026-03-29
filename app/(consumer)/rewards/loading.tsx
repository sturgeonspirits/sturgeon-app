export default function RewardsLoading() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 animate-pulse">
      <div className="pt-4">
        <div className="h-7 w-28 bg-[#D4CFC3] rounded-full" />
      </div>
      {/* Points card */}
      <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 w-28 bg-[#E8E4D6] rounded-full" />
            <div className="h-3.5 w-20 bg-[#D4CFC3] rounded-full" />
          </div>
        ))}
      </div>
      {/* Rewards list */}
      <div>
        <div className="h-3 w-24 bg-[#D4CFC3] rounded-full mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4 flex items-start gap-3">
              <div className="h-8 w-8 bg-[#E8E4D6] rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-36 bg-[#D4CFC3] rounded-full" />
                <div className="h-2.5 w-52 bg-[#E8E4D6] rounded-full" />
                <div className="h-2.5 w-32 bg-[#E8E4D6] rounded-full" />
                <div className="flex justify-between mt-2">
                  <div className="h-5 w-24 bg-[#E8E4D6] rounded-full" />
                  <div className="h-7 w-20 bg-[#D4CFC3] rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
