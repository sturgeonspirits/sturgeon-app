/**
 * Tiny universal "Built with Script Spirit" attribution.
 * Kept deliberately small, subtle, and keyboard-accessible.
 */
export default function AppFooter() {
  return (
    <footer className="w-full py-4 mt-8 text-center text-xs text-[#6B6B5E]">
      <a
        href="https://scriptspirit.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 opacity-70 hover:opacity-100 hover:text-[#96321F] transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#96321F] rounded"
      >
        <StillIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          Built with <span className="font-semibold">Script Spirit</span>
        </span>
      </a>
    </footer>
  )
}

// Minimal alembic/still mark — inline SVG so there's no extra network fetch.
function StillIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* pot body */}
      <path d="M7 20c-2 0-3-1.5-3-3.5S5.5 11 8 11h6c2.5 0 4 3.5 4 5.5S17 20 15 20z" />
      {/* neck */}
      <path d="M11 11V6" />
      {/* lyne arm */}
      <path d="M11 6h5a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
