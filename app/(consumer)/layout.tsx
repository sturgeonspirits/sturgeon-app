import TabBar from '@/components/nav/TabBar'

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Main content — padded so it clears the tab bar */}
      <main className="flex-1 pb-safe overflow-y-auto">
        {children}
      </main>
      <TabBar />
    </div>
  )
}
