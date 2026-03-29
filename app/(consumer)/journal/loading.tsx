export default function JournalLoading() {
  return (
    <div className="max-w-lg mx-auto p-4 animate-pulse">
      <div className="pt-4 flex items-center justify-between mb-4">
        <div className="h-7 w-32 bg-[#D4CFC3] rounded-full" />
        <div className="h-9 w-28 bg-[#D4CFC3] rounded-xl" />
      </div>
      {/* Search */}
      <div className="h-11 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl mb-4" />
      {/* Entries */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 bg-[#E8E4D6] rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 bg-[#D4CFC3] rounded-full" />
                <div className="h-2.5 w-28 bg-[#E8E4D6] rounded-full" />
              </div>
              <div className="h-5 w-14 bg-[#E8E4D6] rounded-full" />
            </div>
            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-[#E8E4D6] rounded-full" />
              <div className="h-2.5 w-3/4 bg-[#E8E4D6] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
