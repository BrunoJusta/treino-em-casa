import { useRef, useState } from 'react'
import { Camera } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { Avatar } from './Avatar'
import type { Profile } from '../data/types'

/** Carrega uma foto de perfil (galeria ou câmara), corta ao quadrado e comprime para 400 px. */
async function squareJpeg(file: File, side = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = side
  c.height = side
  c.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, side, side)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falhou'))), 'image/jpeg', 0.85))
}

export function AvatarUpload({ profile, size = 88, editable = true }: { profile: Profile; size?: number; editable?: boolean }) {
  const { run } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const onFile = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      const blob = await squareJpeg(f)
      await run(() => api.uploadAvatar(profile.id, blob), 'Foto de perfil atualizada')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  if (!editable) return <Avatar avatar={profile.avatar} color={profile.color} name={profile.display_name} size={size} />
  return (
    <button type="button" className="icon-btn plain" style={{ width: 'auto', height: 'auto', position: 'relative', opacity: busy ? 0.6 : 1 }} onClick={() => input.current?.click()} aria-label="Mudar a foto de perfil" disabled={busy}>
      <Avatar avatar={profile.avatar} color={profile.color} name={profile.display_name} size={size} />
      <span style={{ position: 'absolute', right: -6, bottom: -6, background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 12, border: '3px solid #fff', width: 34, height: 34, display: 'grid', placeItems: 'center' }}><Camera size={17} weight="bold" /></span>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </button>
  )
}
