export default function LeaderboardDetailLoading() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 animate-pulse">
      {/* Header */}
      <div className="pt-4 flex items-center gap-3">
        <div className="w-12 h-12 bg-[#E8E4D6] rounded-xl shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-36 bg-[#D4CFC3] rounded-full" />
          <div className="h-3 w-52 bg-[#E8E4D6] rounded-full" />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="h-10 bg-[#E8E4D6] rounded-xl" />

      {/* Board rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="h-5 w-6 bg-[#E8E4D6] rounded-full" />
            <div className="flex-1">
              <div className="h-3.5 w-32 bg-[#D4CFC3] rounded-full" />
            </div>
            <div className="h-4 w-20 bg-[#E8E4D6] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
