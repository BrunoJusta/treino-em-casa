// Fotografia de perfil carregada pela pessoa. Sem foto, mostra as iniciais na cor da pessoa.
interface Props {
  avatar: string
  color: string
  name?: string
  size?: number
  ring?: boolean
  label?: string
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase()
}

export function isPhoto(avatar: string) {
  return /^(https?:|data:|blob:)/.test(avatar)
}

export function Avatar({ avatar, color, name, size = 40, ring = false, label }: Props) {
  const style = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 3px white, 0 0 0 6px ${color}` : `inset 0 0 0 2px color-mix(in srgb, ${color} 55%, white)`,
    background: `color-mix(in srgb, ${color} 22%, white)`,
  }
  return (
    <span className="avatar" style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {isPhoto(avatar) ? (
        <img src={avatar} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
      ) : (
        <span style={{ fontSize: size * 0.38, fontWeight: 750, color: `color-mix(in srgb, ${color} 60%, #4C4F69)`, letterSpacing: '-0.02em' }}>{initials(name)}</span>
      )}
    </span>
  )
}
