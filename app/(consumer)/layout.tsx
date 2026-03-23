import TabBar from '@/components/nav/TabBar'

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col bg-[#F1F1E7]" style={{ height: '100dvh' }}>
      {/* Main content — fixed height, scrollable, padded clear of tab bar */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain pb-4">
        {children}
      </main>
      <TabBar />
    </div>
  )
}
