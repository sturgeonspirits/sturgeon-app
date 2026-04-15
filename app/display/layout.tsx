/**
 * Minimal layout for the public check-in display tablet.
 * No navigation, no chrome — just full-screen content.
 */
export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#242622]">
      {children}
    </div>
  )
}
