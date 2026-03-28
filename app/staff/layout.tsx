import StaffNavBar from './StaffNavBar'

// Staff console — separate layout, no consumer tab bar
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#EDE9DC]">
      <StaffNavBar />
      <main className="p-4 max-w-2xl mx-auto">{children}</main>
    </div>
  )
}
