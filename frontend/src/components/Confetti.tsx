import { useMemo, type CSSProperties } from 'react'

// Only the line's own colours, and few of them: a quiet celebration.
const COLORS = ['#E21A1A', '#1C2430', '#FFFFFF', '#13854E']

export function Confetti({ pieces = 28 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.4,
        dx: (Math.random() - 0.5) * 120,
        rotate: Math.random() * 360,
      })),
    [pieces],
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {items.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              outline: p.color === '#FFFFFF' ? '1px solid #CDD3D9' : undefined,
              transform: `rotate(${p.rotate}deg)`,
              '--delay': `${p.delay}s`,
              '--dur': `${p.dur}s`,
              '--dx': `${p.dx}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
