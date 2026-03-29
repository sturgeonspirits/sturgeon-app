export default function LeaderboardsLoading() {
  return (
    <div className="max-w-lg mx-auto p-4 animate-pulse">
      <div className="pt-4 mb-4">
        <div className="h-7 w-44 bg-[#D4CFC3] rounded-full" />
        <div className="h-3 w-56 bg-[#E8E4D6] rounded-full mt-2" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 flex items-center gap-4">
            <div className="h-14 w-14 bg-[#E8E4D6] rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 bg-[#D4CFC3] rounded-full" />
              <div className="h-2.5 w-44 bg-[#E8E4D6] rounded-full" />
            </div>
            <div className="h-5 w-5 bg-[#E8E4D6] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
