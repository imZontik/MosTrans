import { extendTailwindMerge } from 'tailwind-merge'

// Custom theme tokens from tailwind.config.js, so they merge in the right groups
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ['sheet'] }],
      'font-size': [{ text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'] }],
    },
  },
})

/** Join class names; later Tailwind utilities override conflicting earlier ones. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '))
}
