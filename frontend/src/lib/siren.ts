/** Two-tone siren synthesized with WebAudio (~2 s). Returns false when audio is blocked. */
export async function playSiren(durationSec = 2): Promise<boolean> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return false
  try {
    const ctx = new Ctx()
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)
    if (ctx.state !== 'running') {
      ctx.close()
      return false
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    const t0 = ctx.currentTime
    for (let i = 0; i < durationSec * 2; i++) {
      osc.frequency.setValueAtTime(i % 2 ? 660 : 880, t0 + i * 0.5)
    }
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05)
    gain.gain.setValueAtTime(0.12, t0 + durationSec - 0.15)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + durationSec)
    osc.onended = () => ctx.close()
    return true
  } catch {
    return false
  }
}
