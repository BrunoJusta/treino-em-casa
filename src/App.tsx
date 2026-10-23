import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './data/store'
import { BottomNav, CelebrationOverlay, Toasts } from './components/ui'
import { JarMascot } from './components/pixel/JarMascot'
import { Login } from './pages/Login'
import { Hoje } from './pages/Hoje'
import { Calendario } from './pages/Calendario'
import { Planear } from './pages/Planear'
import { Registar } from './pages/Registar'
import { Player } from './pages/Player'
import { Treinos } from './pages/Treinos'
import { PlanoEditor } from './pages/PlanoEditor'
import { ExercicioDetalhe } from './pages/ExercicioDetalhe'
import { Jarro } from './pages/Jarro'
import { Familia } from './pages/Familia'
import { Perfil } from './pages/Perfil'
import { Corpo } from './pages/Corpo'
import { Admin } from './pages/admin/Admin'

const NO_NAV = ['/treinar', '/player', '/planos/', '/admin']

export function App() {
  const { me, loading, snap, error } = useStore()
  const loc = useLocation()
  if (loading) return <Splash />
  if (!me || !snap) {
    if (error && me === null && snap === null) return <Login />
    return <><Login /><Toasts /></>
  }
  const showNav = !NO_NAV.some((p) => loc.pathname.startsWith(p))
  return (
    <div className={`app ${loc.pathname.startsWith('/admin') ? 'wide' : ''}`}>
      <Routes>
        <Route path="/" element={<Hoje />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/planear" element={<Planear />} />
        <Route path="/treinar" element={<Registar />} />
        <Route path="/player/:planId" element={<Player />} />
        <Route path="/treinos" element={<Treinos />} />
        <Route path="/planos/:id" element={<PlanoEditor />} />
        <Route path="/exercicios/:id" element={<ExercicioDetalhe />} />
        <Route path="/jarro" element={<Jarro />} />
        <Route path="/familia" element={<Familia />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/perfil/:id" element={<Perfil />} />
        <Route path="/corpo" element={<Corpo />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
      <Toasts />
      <CelebrationOverlay />
    </div>
  )
}

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <div className="stack" style={{ alignItems: 'center' }}>
        <JarMascot mood="happy" level={0.35} size={96} />
        <p className="strong">Treino em Casa</p>
      </div>
    </div>
  )
}
