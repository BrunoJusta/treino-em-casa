import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { createHold, fmtClock, fmtKm, POCKET_HOLD_MS } from '../../lib/walk'

/**
 * Modo bolso: ecrã preto por cima de tudo, para gastar menos bateria (nos ecrãs OLED o preto quase não gasta)
 * e para o bolso não carregar em nada. Para sair, mantém o dedo 2 segundos.
 */
export function PocketMode({ open, elapsed, meters, onExit }: { open: boolean; elapsed: number; meters: number; onExit: () => void }) {
  const reduce = useReducedMotion()
  const [holding, setHolding] = useState(false)
  const exitRef = useRef(onExit)
  exitRef.current = onExit
  const hold = useMemo(() => createHold(() => {
    setHolding(false)
    try { navigator.vibrate?.(30) } catch { /* nada */ }
    exitRef.current()
  }), [])
  // mexer o texto uns píxeis por minuto, para não ficar sempre no mesmo sítio do ecrã
  const minute = Math.floor(elapsed / 60000)
  const shift = reduce ? { x: 0, y: 0 } : { x: ((minute * 37) % 41) - 20, y: ((minute * 53) % 61) - 30 }

  useEffect(() => {
    if (!open) { hold.cancel(); setHolding(false); return }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exitRef.current() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); hold.cancel() }
  }, [open, hold])

  if (!open) return null
  const block = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }
  return (
    <div className="pocket" role="dialog" aria-modal="true" aria-label="Modo bolso"
      onPointerDown={(e) => { block(e); hold.start(); setHolding(true) }}
      onPointerUp={(e) => { block(e); hold.cancel(); setHolding(false) }}
      onPointerCancel={() => { hold.cancel(); setHolding(false) }}
      onPointerLeave={() => { hold.cancel(); setHolding(false) }}
      onClick={block} onContextMenu={block} onTouchMove={block}>
      <div className="pocket-body" style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}>
        <p className="pocket-time num">{fmtClock(elapsed)}</p>
        <p className="pocket-km num">{meters > 0 ? fmtKm(meters) : '0,00 km'}</p>
        <div className={`pocket-ring ${holding ? 'on' : ''}`} style={{ ['--hold' as string]: `${POCKET_HOLD_MS}ms` }} aria-hidden />
        <p className="pocket-hint">Mantém o dedo 2 segundos para desbloquear</p>
      </div>
    </div>
  )
}
