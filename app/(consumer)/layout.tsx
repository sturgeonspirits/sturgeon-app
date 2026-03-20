import TabBar from '@/components/nav/TabBar'

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Main content — scrollable, padded clear of tab bar + iOS home indicator */}
      <main className="flex-1 pb-safe overflow-y-auto overscroll-y-contain">
        {children}
      </main>
      <TabBar />
    </div>
  )
}
