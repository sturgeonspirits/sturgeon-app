import TabBar from '@/components/nav/TabBar'
import PushSubscriber from '@/components/PushSubscriber'
import AppFooter from '@/components/ui/AppFooter'

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PushSubscriber />
      {/*
        Page scrolls naturally at the document level — no internal scroll container.
        This works correctly on foldables (Pixel Fold) where 100dvh miscalculates.
        Fixed tab bar stays anchored to the viewport bottom on any screen shape.
        Padding-bottom clears content from behind the tab bar.
        64px = h-16 tab bar height; safe-area-inset-bottom covers gesture bar.
      */}
      <main
        className="bg-[#F1F1E7]"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
        <AppFooter />
      </main>
      <div className="fixed bottom-0 inset-x-0 z-50">
        <TabBar />
      </div>
    </>
  )
}
