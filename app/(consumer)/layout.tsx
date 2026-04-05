import TabBar from '@/components/nav/TabBar'
import PushSubscriber from '@/components/PushSubscriber'

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#F1F1E7]">
      <PushSubscriber />
      {/*
        Tab bar is fixed so it's always anchored to the viewport bottom —
        avoids the 100dvh miscalculation on foldable displays (Pixel Fold etc.)
        Main content gets bottom padding so nothing is hidden behind the bar.
        64px = h-16 tab bar; safe-area-inset-bottom covers gesture / notch area.
      */}
      <main
        className="overflow-y-auto overscroll-y-contain"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>
      <div className="fixed bottom-0 inset-x-0 z-50">
        <TabBar />
      </div>
    </div>
  )
}
