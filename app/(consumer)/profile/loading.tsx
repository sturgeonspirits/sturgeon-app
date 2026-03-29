export default function ProfileLoading() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 animate-pulse">
      <div className="pt-4">
        <div className="h-7 w-24 bg-[#D4CFC3] rounded-full" />
      </div>

      {/* Member card */}
      <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-[#E8E4D6]" />
          <div className="space-y-2">
            <div className="h-4 w-36 bg-[#D4CFC3] rounded-full" />
            <div className="h-3 w-20 bg-[#E8E4D6] rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#D4CFC3]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center space-y-1.5">
              <div className="h-4 w-20 bg-[#D4CFC3] rounded-full mx-auto" />
              <div className="h-2.5 w-12 bg-[#E8E4D6] rounded-full mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div>
        <div className="h-3 w-28 bg-[#D4CFC3] rounded-full mb-3" />
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-[#EDE9DC]">
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 bg-[#D4CFC3] rounded-full" />
                <div className="h-2.5 w-24 bg-[#E8E4D6] rounded-full" />
              </div>
              <div className="h-3.5 w-12 bg-[#E8E4D6] rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
