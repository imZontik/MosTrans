import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'

/** Starts (or resumes) a scenario run and opens the game screen. */
export function useStartRun() {
  const navigate = useNavigate()
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(
    // `from`: where the run's end screen leads back to
    async (scenarioId: number, restart = false, from?: string) => {
      setPending(scenarioId)
      setError(null)
      try {
        const run = await api.startRun(scenarioId, restart)
        navigate(`/play/${run.id}`, from ? { state: { from } } : undefined)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось начать сценарий')
      } finally {
        setPending(null)
      }
    },
    [navigate],
  )

  return { start, pending, error, clearError: () => setError(null) }
}
