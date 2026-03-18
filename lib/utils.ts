import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatPoints(n: number): string {
  return n.toLocaleString()
}

export function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    newcomer:  'Newcomer',
    regular:   'Regular',
    spearer:   'Spearer',
    harpooner: 'Harpooner',
    captain:   'Captain',
  }
  return map[tier] ?? tier
}

export function tierColor(tier: string): string {
  const map: Record<string, string> = {
    newcomer:  '#888888',
    regular:   '#5aadff',
    spearer:   '#f5c842',
    harpooner: '#e87c3e',
    captain:   '#b06aff',
  }
  return map[tier] ?? '#888'
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

export function dayOfWeekLabel(dow: number): string {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow] ?? ''
}
