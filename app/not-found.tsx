import Link from 'next/link'
import { Anchor } from '@/components/icons/brand'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6 text-center">
      <Anchor size={64} className="text-[#9E8F7E] mb-4 mx-auto" />
      <h1 className="text-xl font-bold text-[#242622] mb-1">Page not found</h1>
      <p className="text-sm text-[#7E613F] mb-6 max-w-xs">
        This page doesn't exist — it may have been moved or you might have a bad link.
      </p>
      <Link
        href="/club"
        className="bg-[#96321F] text-white font-semibold text-sm px-6 py-3 rounded-2xl hover:bg-[#ae3a24] transition-colors"
      >
        Back to Spearers Club
      </Link>
    </div>
  )
}
