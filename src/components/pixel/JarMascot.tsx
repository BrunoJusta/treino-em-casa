import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { gridToRects } from './Pixel'
import { PALETTE } from './sprites'

export type Mood = 'happy' | 'wow' | 'sad' | 'party' | 'sleepy'

// O Jarro: a mascote da casa. Frasco de vidro com tampa, que enche de moedas.
// Grelha 20x24. 'i' = interior do vidro (onde entram as moedas).
const BASE = [
  '....................',
  '.....kkkkkkkkkk.....',
  '.....kbbbbbbbbk.....',
  '.....kbwbbbbbbk.....',
  '.....kkkkkkkkkk.....',
  '......kiiiiiik......',
  '....kkiiiiiiiikk....',
  '...kiiiiiiiiiiiik...',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '..kiiiiiiiiiiiiiik..',
  '...kiiiiiiiiiiiik...',
  '....kkkkkkkkkkkk....',
  '....................',
]

const FACES: Record<Mood, [number, string][]> = {
  // [linha, máscara de 20 colunas] desenhada por cima do vidro/moedas
  happy: [
    [10, '......kk....kk......'],
    [11, '......kk....kk......'],
    [12, '....pp........pp....'],
    [13, '.......k....k.......'],
    [14, '........kkkk........'],
  ],
  wow: [
    [10, '......kk....kk......'],
    [11, '......kk....kk......'],
    [12, '....pp........pp....'],
    [13, '.........kk.........'],
    [14, '........k..k........'],
    [15, '.........kk.........'],
  ],
  sad: [
    [10, '......kk....kk......'],
    [11, '......kk....kk......'],
    [12, '.....b..........b...'],
    [13, '........kkkk........'],
    [14, '.......k....k.......'],
  ],
  party: [
    [10, '.....k..k..k..k.....'],
    [11, '......kk....kk......'],
    [12, '....pp........pp....'],
    [13, '.......kkkkkk.......'],
    [14, '........krrk........'],
    [15, '.........kk.........'],
  ],
  sleepy: [
    [11, '.....kkk....kkk.....'],
    [13, '.........kk.........'],
  ],
}

function buildGrid(level: number, mood: Mood): string[] {
  const rows = BASE.map((r) => r.split(''))
  // interior: as linhas 5 a 21 são o vidro. O nível enche de baixo para cima.
  const top = 5
  const bottom = 21
  // enche por camadas inteiras de moedas (3 pixels cada)
  const filled = Math.round(((bottom - top + 1) * Math.max(0, Math.min(1, level))) / 3) * 3
  for (let y = top; y <= bottom; y++) {
    const isCoin = y > bottom - filled
    for (let x = 0; x < 20; x++) {
      if (rows[y][x] !== 'i') continue
      if (isCoin) {
        // moedas empilhadas (de lado): cada moeda tem 5x3 pixels, com rebordo escuro e brilho,
        // e há vidro entre elas para não parecer um líquido
        const fromBottom = bottom - y
        const layer = Math.floor(fromBottom / 3)
        const cy = 2 - (fromBottom % 3)
        const cx = (x - 3 + (layer % 2 ? 2 : 0) + 20) % 5
        if (cy === 0) rows[y][x] = cx === 0 || cx === 4 ? 'l' : cx === 1 ? 'h' : 'y'
        else if (cy === 1) rows[y][x] = cx === 0 || cx === 4 ? 'O' : 'y'
        else rows[y][x] = cx === 0 || cx === 4 ? 'l' : 'O'
      } else {
        rows[y][x] = x === 4 && y > 7 && y < 18 ? 'w' : 'l'
      }
    }
  }
  for (const [y, mask] of FACES[mood]) {
    mask.split('').forEach((ch, x) => {
      if (ch !== '.' && rows[y][x] !== 'k' && rows[y][x] !== '.') rows[y][x] = ch
    })
  }
  return rows.map((r) => r.join(''))
}

interface Props {
  level?: number // 0..1
  mood?: Mood
  size?: number
  bounce?: boolean
  label?: string
}

export function JarMascot({ level = 0.3, mood = 'happy', size = 120, bounce = true, label }: Props) {
  const reduce = useReducedMotion()
  const rects = useMemo(() => gridToRects(buildGrid(level, mood), { ...PALETTE, l: '#E3F5FC', i: '#E3F5FC', y: '#F5BE3B', O: '#A8731A', h: '#FFF1C2' }), [level, mood])
  return (
    <motion.svg
      width={size}
      height={(size * 24) / 20}
      viewBox="0 0 20 24"
      shapeRendering="crispEdges"
      role="img"
      aria-label={label ?? 'O Jarro'}
      animate={bounce && !reduce ? { y: [0, -1.5, 0] } : undefined}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ overflow: 'visible' }}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </motion.svg>
  )
}

/** Moeda em pixel que cai para dentro do jarro. */
export function FallingCoin({ delay = 0, size = 22 }: { delay?: number; size?: number }) {
  const reduce = useReducedMotion()
  const grid = ['..kkkk..', '.kyyyyk.', 'kywyyyok', 'kyyyyyok', 'kyyyyyok', 'kyyyyook', '.kooook.', '..kkkk..']
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      initial={reduce ? { opacity: 0 } : { y: -40, opacity: 0, rotate: 0 }}
      animate={reduce ? { opacity: [0, 1, 0] } : { y: [-40, 30, 24, 40], opacity: [0, 1, 1, 0], rotate: [0, 180, 200, 360] }}
      transition={{ duration: 1.1, delay, ease: 'easeIn' }}
      style={{ position: 'absolute', left: '50%', marginLeft: -size / 2, top: 0 }}
      aria-hidden
    >
      {gridToRects(grid).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </motion.svg>
  )
}
