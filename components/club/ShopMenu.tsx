'use client'

import { useState } from 'react'

const SHOP_LINKS = [
  {
    href:  'https://order.toasttab.com/online/sturgeon-spirits-craft-distillery',
    icon:  '🍸',
    label: 'Order Online',
    desc:  'Order bottles, boxes, merch, and more for pickup',
  },
  {
    href:  'https://www.sturgeonspirits.com/pre-orders',
    icon:  '🥃',
    label: 'Pre-Orders',
    desc:  'Pre-order upcoming releases',
  },
  {
    href:  'https://sturgeonspirits.myshopify.com/',
    icon:  '📦',
    label: 'Direct to Consumer',
    desc:  'Ship bottles to your door',
  },
] as const

export default function ShopMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Grid card — same visual style as the live tiles */}
      <button
        onClick={() => setOpen(true)}
        className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 flex flex-col gap-2 text-left hover:border-[#C8BCA4] active:scale-[0.98] transition-all w-full"
      >
        <span className="text-2xl">🛒</span>
        <div>
          <p className="text-sm font-semibold text-[#242622]">Shop</p>
          <p className="text-xs text-[#7E613F] mt-0.5">Order, pre-order & ship</p>
        </div>
      </button>

      {/* Bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Sheet — z-[60] sits above fixed tab bar (z-50); max-h + scroll prevents cutoff */}
          <div
            className="relative bg-[#F1F1E7] rounded-t-2xl px-4 pt-4 space-y-3 overflow-y-auto"
            style={{
              maxHeight: '75dvh',
              paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-display text-base font-bold text-[#242622]">Shop</p>
              <button
                onClick={() => setOpen(false)}
                className="text-[#7E613F] text-sm hover:text-[#242622] transition-colors"
              >
                ✕
              </button>
            </div>

            {SHOP_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-4 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 hover:border-[#C8BCA4] active:scale-[0.99] transition-all"
              >
                <span className="text-2xl">{link.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#242622]">{link.label}</p>
                  <p className="text-xs text-[#7E613F]">{link.desc}</p>
                </div>
                <span className="text-[#C8BCA4] text-lg">→</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
