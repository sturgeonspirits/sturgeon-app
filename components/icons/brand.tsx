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

// ─── Additional icons ─────────────────────────────────────────────────────────

/** Trophy cup — finalize night, standings hero */
export function Trophy({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 32 34" className={className}>
      {/* Cup body */}
      <path d="M7 2 L25 2 L25 16 Q25 26 16 26 Q7 26 7 16 Z" strokeWidth="2.5" />
      {/* Left handle */}
      <path d="M7 8 Q2 8 2 14 Q2 20 7 20" strokeWidth="2.5" />
      {/* Right handle */}
      <path d="M25 8 Q30 8 30 14 Q30 20 25 20" strokeWidth="2.5" />
      {/* Stem */}
      <line x1="16" y1="26" x2="16" y2="31" strokeWidth="2.5" />
      {/* Base */}
      <line x1="9" y1="31" x2="23" y2="31" strokeWidth="3" />
    </svg>
  )
}

/** Magnifying glass — search empty states */
export function Search({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      <circle cx="10" cy="10" r="7" strokeWidth="2.5" />
      <line x1="15.5" y1="15.5" x2="22" y2="22" strokeWidth="3" />
    </svg>
  )
}

/** Sliders — settings / staff portal link */
export function Sliders({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Top rail */}
      <line x1="2" y1="5"  x2="22" y2="5"  strokeWidth="2" />
      <circle cx="16" cy="5"  r="2.5" fill="currentColor" stroke="none" />
      {/* Middle rail */}
      <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2" />
      <circle cx="8"  cy="12" r="2.5" fill="currentColor" stroke="none" />
      {/* Bottom rail */}
      <line x1="2" y1="19" x2="22" y2="19" strokeWidth="2" />
      <circle cx="16" cy="19" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Calendar — events pages */
export function CalendarIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Body */}
      <rect x="1" y="3" width="22" height="20" rx="2" strokeWidth="2.5" />
      {/* Header divider */}
      <line x1="1" y1="9" x2="23" y2="9" strokeWidth="2" />
      {/* Peg left */}
      <line x1="7"  y1="1" x2="7"  y2="6" strokeWidth="2.5" />
      {/* Peg right */}
      <line x1="17" y1="1" x2="17" y2="6" strokeWidth="2.5" />
      {/* Date diamond — center of body */}
      <path d="M12 13 L15 16 L12 19 L9 16 Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Ticket — redemptions, RSVP */
export function Ticket({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 32 16" className={className}>
      {/* Body */}
      <rect x="1" y="1" width="30" height="14" rx="2" strokeWidth="2.5" />
      {/* Left notch */}
      <path d="M1 5.5 Q5 8 1 10.5" strokeWidth="2" />
      {/* Right notch */}
      <path d="M31 5.5 Q27 8 31 10.5" strokeWidth="2" />
      {/* Perforation */}
      <line x1="11" y1="2" x2="11" y2="14" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  )
}

/** Person silhouette — customers */
export function Person({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Head */}
      <circle cx="12" cy="7" r="4.5" strokeWidth="2.5" />
      {/* Shoulders */}
      <path d="M2 22 Q2 14 12 14 Q22 14 22 22" strokeWidth="2.5" />
    </svg>
  )
}

/** Bar chart — dashboard */
export function BarChart({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 22" className={className}>
      <rect x="1"  y="12" width="6" height="8"  strokeWidth="2" />
      <rect x="9"  y="6"  width="6" height="14" strokeWidth="2.5" />
      <rect x="17" y="2"  width="6" height="18" strokeWidth="2" />
      <line x1="1" y1="21" x2="23" y2="21" strokeWidth="2.5" />
    </svg>
  )
}

/** Clipboard — missions */
export function Clipboard({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 28" className={className}>
      {/* Board */}
      <rect x="2" y="5" width="20" height="22" rx="2" strokeWidth="2.5" />
      {/* Clip */}
      <rect x="8" y="1" width="8" height="7" rx="1.5" strokeWidth="2" />
      {/* Lines */}
      <line x1="6" y1="13" x2="18" y2="13" strokeWidth="2" />
      <line x1="6" y1="18" x2="14" y2="18" strokeWidth="2" />
      <line x1="6" y1="23" x2="18" y2="23" strokeWidth="2" />
    </svg>
  )
}

/** Camera — QR scan button */
export function Camera({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 28 22" className={className}>
      {/* Viewfinder notch */}
      <path d="M9 5 L10 1 L18 1 L19 5" strokeWidth="2" />
      {/* Body */}
      <rect x="1" y="5" width="26" height="16" rx="3" strokeWidth="2.5" />
      {/* Lens outer */}
      <circle cx="14" cy="13" r="5"   strokeWidth="2.5" />
      {/* Lens inner */}
      <circle cx="14" cy="13" r="2"   fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Sync arrows — Toast sync */
export function SyncArrows({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Top arc: left → right */}
      <path d="M4 8 Q4 2 12 2 Q18 2 20 6" strokeWidth="2.5" />
      <path d="M20 6 L20 2 M20 6 L16 6" strokeWidth="2.5" />
      {/* Bottom arc: right → left */}
      <path d="M20 16 Q20 22 12 22 Q6 22 4 18" strokeWidth="2.5" />
      <path d="M4 18 L4 22 M4 18 L8 18" strokeWidth="2.5" />
    </svg>
  )
}

/** Document with fold — file upload */
export function Document({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 22 28" className={className}>
      {/* Body with corner fold */}
      <path d="M2 2 L14 2 L20 8 L20 26 L2 26 Z" strokeWidth="2.5" />
      {/* Fold triangle */}
      <path d="M14 2 L14 8 L20 8" strokeWidth="2" />
      {/* Content lines */}
      <line x1="5" y1="13" x2="17" y2="13" strokeWidth="2" />
      <line x1="5" y1="17" x2="17" y2="17" strokeWidth="2" />
      <line x1="5" y1="21" x2="12" y2="21" strokeWidth="2" />
    </svg>
  )
}

/** Package / box — DTC / shipping link */
export function Package({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24" className={className}>
      {/* Box body */}
      <path d="M2 8 L12 3 L22 8 L22 20 L12 25 L2 20 Z" strokeWidth="2.5" />
      {/* Top edge */}
      <path d="M2 8 L12 13 L22 8" strokeWidth="2" />
      {/* Center spine */}
      <line x1="12" y1="13" x2="12" y2="25" strokeWidth="2" />
      {/* Left seam */}
      <path d="M7 5.5 L7 16" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * Placement ring — leaderboard 1st / 2nd / 3rd.
 * Renders a circle with the rank number inside using brand metallic tones.
 * Uses inline SVG text so it works at any size without extra deps.
 */
export function PlaceRing({ place, size = 28 }: { place: number; size?: number }) {
  const palette: Record<number, { ring: string; fill: string }> = {
    1: { ring: '#B8860B', fill: '#96321F' }, // dark-gold ring, rust numeral
    2: { ring: '#888888', fill: '#555555' }, // silver
    3: { ring: '#8B4513', fill: '#7E613F' }, // sienna / bronze
  }
  const { ring, fill } = palette[place] ?? { ring: '#D4CFC3', fill: '#9E8F7E' }
  const fs = Math.round(size * 0.46)
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke={ring} strokeWidth="2.5" />
      <text
        x="14" y="19"
        textAnchor="middle"
        fontSize={fs}
        fontWeight="700"
        fill={fill}
        fontFamily="Georgia, serif"
      >
        {place}
      </text>
    </svg>
  )
}
