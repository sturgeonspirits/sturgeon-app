export default function ClubLoading() {
  return (
    <div className="max-w-lg mx-auto animate-pulse">
      {/* Hero */}
      <div className="px-4 pt-12 pb-8 space-y-4">
        <div className="h-3 w-24 bg-[#D4CFC3] rounded-full" />
        <div className="h-7 w-40 bg-[#D4CFC3] rounded-full" />
        <div className="flex items-end gap-3 mt-4">
          <div className="h-10 w-28 bg-[#D4CFC3] rounded-full" />
          <div className="h-6 w-20 bg-[#D4CFC3] rounded-full mb-1" />
        </div>
      </div>

      <div className="px-4 space-y-6 pb-6">
        {/* Tier progress */}
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-3">
          <div className="flex justify-between">
            <div className="space-y-1.5">
              <div className="h-2.5 w-16 bg-[#D4CFC3] rounded-full" />
              <div className="h-3.5 w-20 bg-[#D4CFC3] rounded-full" />
            </div>
            <div className="space-y-1.5 items-end flex flex-col">
              <div className="h-2.5 w-14 bg-[#D4CFC3] rounded-full" />
              <div className="h-3.5 w-20 bg-[#D4CFC3] rounded-full" />
            </div>
          </div>
          <div className="h-1.5 bg-[#E8E4D6] rounded-full" />
          <div className="h-2.5 w-40 bg-[#D4CFC3] rounded-full" />
        </div>

        {/* Explore grid */}
        <div>
          <div className="h-3 w-16 bg-[#D4CFC3] rounded-full mb-3" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-2">
                <div className="h-7 w-7 bg-[#E8E4D6] rounded-lg" />
                <div className="space-y-1">
                  <div className="h-3 w-24 bg-[#D4CFC3] rounded-full" />
                  <div className="h-2.5 w-32 bg-[#E8E4D6] rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Missions */}
        <div>
          <div className="h-3 w-20 bg-[#D4CFC3] rounded-full mb-3" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-2">
                <div className="h-8 w-8 bg-[#E8E4D6] rounded-full" />
                <div className="h-3 w-20 bg-[#D4CFC3] rounded-full" />
                <div className="h-2 w-28 bg-[#E8E4D6] rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
