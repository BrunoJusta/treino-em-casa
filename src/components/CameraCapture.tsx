import { useEffect, useRef, useState } from 'react'
import { CameraRotate, X } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { compressImage } from '../lib/image'
import { sfx, vibrate } from '../lib/fx'
import { JarMascot } from './pixel/JarMascot'

export interface Shot {
  blob: Blob
  url: string
  at: string
}

/**
 * Câmara em ecrã inteiro com corte 4:5, como no feed. Usada no registo dos treinos e no fim das caminhadas.
 * Se a câmara não abrir no browser, usa a câmara do telemóvel (input de ficheiro).
 */
export function CameraCapture({ title, hint, defaultFacing, onShot, onCancel, fileMaxAgeMs }: {
  title: string
  hint: string
  defaultFacing: 'user' | 'environment'
  onShot: (shot: Shot) => void
  onCancel: () => void
  fileMaxAgeMs?: number // fotos do ficheiro mais antigas do que isto são recusadas (treinos: 10 min)
}) {
  const { toast } = useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>(defaultFacing)
  const [camErr, setCamErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem câmara')
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1440 }, height: { ideal: 1800 } }, audio: false })
        if (cancelled) { st.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = st
        if (videoRef.current) {
          videoRef.current.srcObject = st
          await videoRef.current.play().catch(() => {})
        }
        setCamErr(null)
      } catch {
        setCamErr('Não consegui abrir a câmara aqui. Usa o botão para tirar a foto com a câmara do telemóvel.')
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [facing])

  const take = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    sfx.beep()
    vibrate(30)
    // corte 4:5 ao centro, como no feed
    const targetRatio = 4 / 5
    let sw = v.videoWidth
    let sh = v.videoHeight
    let sx = 0
    let sy = 0
    if (sw / sh > targetRatio) { const w = sh * targetRatio; sx = (sw - w) / 2; sw = w } else { const h = sw / targetRatio; sy = (sh - h) / 2; sh = h }
    const c = document.createElement('canvas')
    c.width = Math.min(1080, Math.round(sw))
    c.height = Math.round(c.width / targetRatio)
    const g = c.getContext('2d')!
    if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1) }
    g.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height)
    const blob = await compressImage(c)
    onShot({ blob, url: URL.createObjectURL(blob), at: new Date().toISOString() })
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (fileMaxAgeMs && Date.now() - f.lastModified > fileMaxAgeMs) {
      toast('A foto tem de ser tirada agora, com a câmara.', 'error')
      return
    }
    const blob = await compressImage(f)
    onShot({ blob, url: URL.createObjectURL(blob), at: new Date().toISOString() })
  }

  return (
    <div className="camera">
      <div className="row between" style={{ position: 'absolute', top: 'calc(12px + var(--safe-t))', left: 16, right: 16, zIndex: 2 }}>
        <button className="icon-btn" style={{ background: 'rgba(0,0,0,.45)', color: '#fff', border: 0 }} aria-label="Cancelar" onClick={onCancel}><X size={22} weight="bold" /></button>
        <span className="chip" style={{ background: 'rgba(0,0,0,.45)', color: '#fff', border: 0 }}>{title}</span>
        <span style={{ width: 44 }} />
      </div>
      {camErr ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, color: '#fff', textAlign: 'center' }}>
          <div className="stack" style={{ alignItems: 'center' }}>
            <JarMascot mood="wow" size={90} />
            <p>{camErr}</p>
            <button className="btn primary big" onClick={() => fileRef.current?.click()}>Abrir a câmara</button>
            <input ref={fileRef} type="file" accept="image/*" capture={facing} hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>
      ) : (
        <video ref={videoRef} playsInline muted autoPlay style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined, aspectRatio: '4 / 5' }} />
      )}
      <div className="camera-bar">
        <p className="small" style={{ width: 90, opacity: 0.8 }}>{hint}</p>
        <button className="shutter" aria-label="Tirar foto" onClick={take} disabled={!!camErr} />
        <button className="icon-btn" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: 0, width: 56, height: 56 }} aria-label="Trocar de câmara" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}><CameraRotate size={26} /></button>
      </div>
    </div>
  )
}
