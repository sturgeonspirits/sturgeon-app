export default function CheckInLoading() {
  return (
    <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6 text-center animate-pulse">
        <div className="w-14 h-14 bg-[#D4CFC3] rounded-full mx-auto" />
        <div className="space-y-2">
          <div className="h-7 bg-[#D4CFC3] rounded-xl w-40 mx-auto" />
          <div className="h-4 bg-[#D4CFC3] rounded-xl w-64 mx-auto" />
        </div>
        <div className="h-14 bg-[#D4CFC3] rounded-2xl w-full" />
      </div>
    </div>
  )
}
