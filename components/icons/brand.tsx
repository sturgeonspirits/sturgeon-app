// ─────────────────────────────────────────────
// Changelog
//   v2026-05-31.1 — Custom bold-geometric SVG icon library for Sturgeon Spirits
//                   / Spearers Club. No stock icons. No emoji.
// ─────────────────────────────────────────────
//
// Usage:
//   import { CocktailGlass, Spear, RocksGlass } from '@/components/icons/brand'
//   <CocktailGlass size={24} className="text-[#96321F]" />
//
// All icons:
//   • inherit color via `currentColor` (stroke + fill)
//   • accept `size` (px, default 24) and `className`
//   • bold geometric style — strokeWidth 2–3 on their native viewBox

import type { SVGProps } from 'react'

interface IconProps {
  size?: number
  className?: string
}

// Shared SVG attributes applied to every icon root
function base(size: number): SVGProps<SVGSVGElement> {
  return {
    width:           size,
    height:          size,
    fill:            'none',
    stroke:          'currentColor',
    strokeLinecap:   'round',
    strokeLinejoin:  'round',
  }
}

// ─── Nav-scale icons (designed on 24 × 24 grid) ──────────────────────────────

/** Coupe / cocktail glass — for the Cocktail Menu tile */
export function CocktailGlass({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Rim */}
      <line x1="1" y1="4" x2="23" y2="4" strokeWidth="2.5" />
      {/* Bowl — gentle parabola */}
      <path d="M1 4 Q12 19 23 4" strokeWidth="2" />
      {/* Stem */}
      <line x1="12" y1="17" x2="12" y2="21" strokeWidth="2" />
      {/* Base */}
      <line x1="7" y1="21" x2="17" y2="21" strokeWidth="2.5" />
      {/* Olive on a pick */}
      <line x1="19.5" y1="5.5" x2="16.5" y2="8.5" strokeWidth="1.5" />
      <circle cx="20.5" cy="4.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Fountain-pen nib — for Tasting Journal */
export function PenNib({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Nib body — pointed diamond shape */}
      <path d="M12 22 L3 9 L8 2 L16 2 L21 9 Z" strokeWidth="2.5" />
      {/* Center slit */}
      <line x1="12" y1="22" x2="12" y2="12" strokeWidth="2" />
      {/* Breather hole */}
      <circle cx="12" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Three-step podium — for Standings / leaderboards */
export function Podium({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 22" className={className}>
      {/* 2nd place */}
      <rect x="1"  y="8"  width="7" height="13" strokeWidth="2" />
      {/* 1st place — tallest, center */}
      <rect x="9"  y="3"  width="6" height="18" strokeWidth="2.5" />
      {/* 3rd place */}
      <rect x="16" y="12" width="7" height="9"  strokeWidth="2" />
      {/* Floor line */}
      <line x1="1" y1="21" x2="23" y2="21" strokeWidth="2.5" />
    </svg>
  )
}

/** Ribbon medal — for Rewards */
export function Medal({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Ribbon left leg */}
      <path d="M10 11 L6 2" strokeWidth="2" />
      {/* Ribbon right leg */}
      <path d="M14 11 L18 2" strokeWidth="2" />
      {/* Ribbon cross-bar */}
      <line x1="6" y1="2" x2="18" y2="2" strokeWidth="2.5" />
      {/* Medal circle */}
      <circle cx="12" cy="17" r="6" strokeWidth="2.5" />
      {/* 5-pointed star, filled */}
      <path
        d="M12 13.2 l1.1 3.3 3.5 0 -2.8 2.1 1.1 3.4 -2.9-2.1 -2.9 2.1 1.1-3.4 -2.8-2.1 3.5 0 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

/** Diamond card suit — for Events */
export function DiamondSuit({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      <path d="M12 2 L22 12 L12 22 L2 12 Z" strokeWidth="2.5" />
    </svg>
  )
}

/**
 * Downward spear — for Check In.
 * The tip points down: you're planting your flag at the distillery.
 */
export function Spear({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Spearhead — diamond tip pointing down */}
      <path d="M12 22 L7 14 L12 10 L17 14 Z" strokeWidth="2.5" />
      {/* Shaft */}
      <line x1="12" y1="10" x2="12" y2="3" strokeWidth="2.5" />
      {/* Cross-guard */}
      <line x1="8" y1="6" x2="16" y2="6" strokeWidth="2.5" />
    </svg>
  )
}

/** Spirits bottle — for Shop / Book an Event */
export function SpiritsBottle({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 20 30" className={className}>
      {/* Cork / stopper */}
      <rect x="7" y="1" width="6" height="3.5" rx="0.5" fill="currentColor" stroke="none" />
      {/* Neck */}
      <line x1="7"  y1="4.5" x2="5"  y2="9"  strokeWidth="2" />
      <line x1="13" y1="4.5" x2="15" y2="9"  strokeWidth="2" />
      {/* Shoulders + body */}
      <path d="M5 9 Q2 13 2 16 L2 25 Q2 29 10 29 Q18 29 18 25 L18 16 Q18 13 15 9" strokeWidth="2.5" />
      {/* Label lines */}
      <line x1="5"  y1="17" x2="15" y2="17" strokeWidth="1.5" />
      <line x1="5"  y1="23" x2="15" y2="23" strokeWidth="1.5" />
    </svg>
  )
}

/** Two glasses touching rims — small nav version for Book an Event */
export function GlassesTouch({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 22" className={className}>
      {/* Left glass (leans right — top shifts right vs. base) */}
      <line x1="4"  y1="3"  x2="12" y2="3"  strokeWidth="2.5" />
      <line x1="4"  y1="3"  x2="2"  y2="19" strokeWidth="2" />
      <line x1="12" y1="3"  x2="9"  y2="19" strokeWidth="2" />
      <line x1="2"  y1="19" x2="9"  y2="19" strokeWidth="2.5" />
      {/* Right glass (leans left) */}
      <line x1="12" y1="3"  x2="20" y2="3"  strokeWidth="2.5" />
      <line x1="12" y1="3"  x2="15" y2="19" strokeWidth="2" />
      <line x1="20" y1="3"  x2="22" y2="19" strokeWidth="2" />
      <line x1="15" y1="19" x2="22" y2="19" strokeWidth="2.5" />
      {/* Clink spark */}
      <line x1="12" y1="2"  x2="12" y2="0"  strokeWidth="2" />
    </svg>
  )
}

// ─── Hero-scale icons (48–64 px, used for full-screen moments) ───────────────

/**
 * Rocks glass / lowball — check-in success.
 * Bold, weighted base. Ice sphere inside.
 */
export function RocksGlass({ size = 56, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 48 54" className={className}>
      {/* Rim */}
      <line x1="4"  y1="7"  x2="44" y2="7"  strokeWidth="4" />
      {/* Left wall — slightly tapered (wider at top) */}
      <line x1="4"  y1="7"  x2="8"  y2="49" strokeWidth="3" />
      {/* Right wall */}
      <line x1="44" y1="7"  x2="40" y2="49" strokeWidth="3" />
      {/* Base */}
      <line x1="8"  y1="49" x2="40" y2="49" strokeWidth="4" />
      {/* Liquid surface */}
      <path d="M10 30 Q24 27 38 30" strokeWidth="2.5" />
      {/* Ice sphere */}
      <circle cx="24" cy="40" r="8" strokeWidth="2.5" />
      {/* Ice shine */}
      <path d="M19 36 Q21 33 25 35" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * Two rocks glasses clinking — birthday celebration.
 * Pre-computed angled coordinates (no transforms).
 */
export function GlassesClinking({ size = 64, className }: IconProps) {
  // Left glass: rim (16,8)→(32,8), leans right (base shifts left)
  // Right glass: rim (32,8)→(48,8), leans left (base shifts right)
  // They share the clink point at x=32, y=8
  return (
    <svg {...base(size)} viewBox="0 0 64 60" className={className}>
      {/* ── Left glass ── */}
      <line x1="16" y1="8"  x2="32" y2="8"  strokeWidth="4" />  {/* rim */}
      <line x1="16" y1="8"  x2="6"  y2="50" strokeWidth="3" />  {/* left wall */}
      <line x1="32" y1="8"  x2="22" y2="50" strokeWidth="3" />  {/* right wall */}
      <line x1="6"  y1="50" x2="22" y2="50" strokeWidth="4" />  {/* base */}
      <path d="M9 31 Q15 29 21 31"            strokeWidth="2.5" /> {/* liquid */}
      <circle cx="14" cy="41" r="6"           strokeWidth="2.5" /> {/* ice */}
      <path d="M11 38 Q13 36 16 37"           strokeWidth="1.5" /> {/* ice shine */}

      {/* ── Right glass ── */}
      <line x1="32" y1="8"  x2="48" y2="8"  strokeWidth="4" />
      <line x1="32" y1="8"  x2="42" y2="50" strokeWidth="3" />
      <line x1="48" y1="8"  x2="58" y2="50" strokeWidth="3" />
      <line x1="42" y1="50" x2="58" y2="50" strokeWidth="4" />
      <path d="M43 31 Q49 29 55 31"           strokeWidth="2.5" />
      <circle cx="50" cy="41" r="6"           strokeWidth="2.5" />
      <path d="M47 38 Q49 36 52 37"           strokeWidth="1.5" />

      {/* ── Clink sparks at (32, 8) ── */}
      <line x1="32" y1="6" x2="32" y2="1" strokeWidth="2.5" />
      <line x1="29" y1="7" x2="25" y2="3" strokeWidth="2.5" />
      <line x1="35" y1="7" x2="39" y2="3" strokeWidth="2.5" />
    </svg>
  )
}

/**
 * Maritime anchor — for error / expired states.
 * Crossbar ends capped with filled circles.
 */
export function Anchor({ size = 48, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 32 38" className={className}>
      {/* Ring at top */}
      <circle cx="16" cy="6"  r="4.5" strokeWidth="3" />
      {/* Vertical shaft */}
      <line x1="16" y1="10.5" x2="16" y2="32" strokeWidth="3" />
      {/* Crossbar */}
      <line x1="3"  y1="17"   x2="29" y2="17" strokeWidth="3" />
      {/* Left fluke */}
      <path d="M16 32 Q9 32 6 26"  strokeWidth="3" />
      {/* Right fluke */}
      <path d="M16 32 Q23 32 26 26" strokeWidth="3" />
      {/* Crossbar end-caps — solid dots */}
      <circle cx="3"  cy="17" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="29" cy="17" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * Copper pot still — for the check-in page header.
 * Pot belly + column + swan neck + lyne arm.
 */
export function CopperStill({ size = 56, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 60 62" className={className}>
      {/* Pot belly — rounded top, straight sides */}
      <path d="M6 58 L6 38 Q6 22 30 22 Q54 22 54 38 L54 58 Z" strokeWidth="3" />
      {/* Floor / base line */}
      <line x1="2"  y1="58" x2="58" y2="58" strokeWidth="3.5" />
      {/* Column (neck above pot) */}
      <rect x="23" y="10" width="14" height="12" rx="2" strokeWidth="3" />
      {/* Swan neck — curves right then down */}
      <path d="M30 10 Q30 3 40 3 Q48 3 48 10 L48 18" strokeWidth="3" />
      {/* Lyne arm — angled down-right toward condenser */}
      <line x1="48" y1="18" x2="56" y2="28" strokeWidth="2.5" />
    </svg>
  )
}

/** Clean envelope — for auth / email screens */
export function Envelope({ size = 48, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 36 26" className={className}>
      {/* Body */}
      <rect x="1" y="1" width="34" height="24" rx="2.5" strokeWidth="2.5" />
      {/* Flap V */}
      <path d="M1 3 L18 15 L35 3" strokeWidth="2" />
    </svg>
  )
}

/** Shopping bag — for the Shop tile */
export function ShoppingBag({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Bag body */}
      <path d="M3 7 L21 7 L19 22 L5 22 Z" strokeWidth="2.5" />
      {/* Handle */}
      <path d="M9 7 Q9 2 12 2 Q15 2 15 7" strokeWidth="2" />
    </svg>
  )
}
