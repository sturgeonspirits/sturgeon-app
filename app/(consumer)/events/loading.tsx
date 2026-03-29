export default function EventsLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 pb-10 animate-pulse">
      <div className="pt-10 mb-6">
        <div className="h-7 w-24 bg-[#D4CFC3] rounded-full" />
        <div className="h-3 w-52 bg-[#E8E4D6] rounded-full mt-2" />
      </div>
      {/* Upcoming */}
      <div className="mb-8">
        <div className="h-3 w-20 bg-[#D4CFC3] rounded-full mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4">
              <div className="w-12 h-12 bg-[#E8E4D6] rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-36 bg-[#D4CFC3] rounded-full" />
                <div className="h-2.5 w-48 bg-[#E8E4D6] rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Every week */}
      <div>
        <div className="h-3 w-24 bg-[#D4CFC3] rounded-full mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4">
              <div className="w-12 h-12 bg-[#E8E4D6] rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-28 bg-[#D4CFC3] rounded-full" />
                <div className="h-2.5 w-40 bg-[#E8E4D6] rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
