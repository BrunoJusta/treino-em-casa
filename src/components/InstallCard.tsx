import { useEffect, useState } from 'react'
import { DeviceMobile, Export, PlusSquare, X } from '@phosphor-icons/react'
import { canPrompt, isIOS, isIOSSafari, isStandalone, onInstallChange, promptInstall } from '../lib/install'

const KEY = 'tec-install-dismissed'
const DAYS = 14

function dismissedRecently() {
  try { return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < DAYS * 86400_000 } catch { return false }
}

/** Convite para pôr a app no ecrã principal. Só aparece no telemóvel e quando ainda não está instalada. */
export function InstallCard() {
  const [, force] = useState(0)
  const [hidden, setHidden] = useState(() => isStandalone() || dismissedRecently())
  useEffect(() => onInstallChange(() => force((n) => n + 1)), [])
  if (hidden || isStandalone()) return null
  const ios = isIOS()
  if (!ios && !canPrompt()) return null
  const close = () => { try { localStorage.setItem(KEY, String(Date.now())) } catch { /* nada */ } setHidden(true) }
  return (
    <section className="card accent stack-sm" aria-label="Instalar a app">
      <div className="row">
        <img src="/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
        <div className="grow"><p className="strong">Põe a app no ecrã principal</p><p className="small" style={{ color: 'var(--ink-2)' }}>Abre num toque, em ecrã inteiro, como as outras apps.</p></div>
        <button className="icon-btn plain" aria-label="Agora não" onClick={close}><X size={20} /></button>
      </div>
      {ios ? (
        isIOSSafari() ? (
          <ol className="small" style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink-2)' }}>
            <li>Toca em <Export size={16} weight="bold" style={{ display: 'inline', verticalAlign: '-3px' }} aria-label="Partilhar" /> <strong>Partilhar</strong>, na barra do Safari.</li>
            <li>Escolhe <PlusSquare size={16} weight="bold" style={{ display: 'inline', verticalAlign: '-3px' }} aria-hidden /> <strong>Adicionar ao ecrã principal</strong>.</li>
            <li>Toca em <strong>Adicionar</strong>.</li>
          </ol>
        ) : (
          <p className="small" style={{ color: 'var(--ink-2)' }}>No iPhone, abre este link no <strong>Safari</strong> para o poderes adicionar ao ecrã principal.</p>
        )
      ) : (
        <button className="btn primary block" onClick={() => void promptInstall()}><DeviceMobile size={20} weight="bold" /> Instalar app</button>
      )}
    </section>
  )
}
