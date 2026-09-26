import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TIPS, tipIndexOfTheDay } from '@/lib/tips'
import { Mascot } from './Mascot'

const pagerButton =
  'grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[.06] hover:text-ink coarse:h-11 coarse:w-11'

/**
 * «Совет дня»: Вова says the tip in a speech bubble and stands in the corner of the card, peeking over its
 * bottom edge with a face to match the tip. ‹ › leafs through the other tips; each new one pops in.
 */
export function VovaTip({ className }: { className?: string }) {
  const [index, setIndex] = useState(tipIndexOfTheDay)
  const tip = TIPS[index]
  const go = (step: number) => setIndex((i) => (i + step + TIPS.length) % TIPS.length)

  return (
    <section className={cn('card relative isolate flex flex-col overflow-hidden p-5 sm:p-6', className)} aria-labelledby="vova-tip">
      {/* a warm pool of light behind Вова */}
      <div
        className="pointer-events-none absolute -bottom-20 -right-16 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--warn)/.2),transparent_62%)] dark:bg-[radial-gradient(circle,rgb(120_150_210/.22),transparent_62%)]"
        aria-hidden
      />

      <div className="flex items-center justify-between gap-3">
        <h2 id="vova-tip" className="text-lg font-semibold">
          Совет дня
        </h2>
        <div className="-mr-2 flex items-center">
          <button type="button" onClick={() => go(-1)} className={pagerButton} aria-label="Предыдущий совет">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="digits min-w-[3.5ch] text-center text-sm text-muted">
            {index + 1}/{TIPS.length}
          </span>
          <button type="button" onClick={() => go(1)} className={pagerButton} aria-label="Следующий совет">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* the bubble; its tail points down at Вова */}
      <blockquote
        key={index}
        className="tip-in relative mt-4 rounded-2xl rounded-br-md border border-line/80 bg-surface-2 px-4 py-3.5 text-base shadow-card"
        aria-live="polite"
      >
        {tip.text}
        <span className="absolute -bottom-[7px] right-12 h-3.5 w-3.5 rotate-45 border-b border-r border-line/80 bg-surface-2" aria-hidden />
      </blockquote>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <p className="pb-5 leading-tight">
          <span className="block font-semibold">Вова</span>
          <span className="text-xs text-muted">поездной электромеханик</span>
        </p>
        <Mascot key={index} mood={tip.mood} className="mascot-pop -mb-7 -mr-1 h-28 w-28 shrink-0 sm:-mb-8 sm:h-32 sm:w-32" />
      </div>
    </section>
  )
}
