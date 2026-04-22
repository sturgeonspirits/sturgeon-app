import StaffNavBar from './StaffNavBar'
import AppFooter from '@/components/ui/AppFooter'

// Staff console — separate layout, no consumer tab bar
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#EDE9DC] flex flex-col">
      <StaffNavBar />
      <main className="p-4 max-w-2xl mx-auto w-full flex-1">{children}</main>
      <AppFooter />
    </div>
  )
}
