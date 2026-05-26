import { NavLink } from 'react-router-dom'
import { useVet } from '../context/VetContext'

const navStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 16px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: isActive ? 600 : 400,
  color: isActive ? '#7c3aed' : '#475569',
  background: isActive ? '#f5f3ff' : 'transparent',
  transition: 'all 0.15s',
})

export default function Sidebar() {
  const { hasPro, hasPlus } = useVet()

  return (
    <aside style={{
      width: '220px',
      minHeight: '100vh',
      background: '#fff',
      borderRight: '1px solid #e2e8f0',
      padding: '24px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 16px 20px', fontWeight: 800, fontSize: '18px', color: '#7c3aed' }}>
        🐾 Lumi Vet
      </div>

      <NavLink to="/dashboard" style={({ isActive }) => navStyle(isActive)}>
        📊 Dashboard
      </NavLink>
      <NavLink to="/appointments" style={({ isActive }) => navStyle(isActive)}>
        📅 Agenda
      </NavLink>
      <NavLink to="/patients" style={({ isActive }) => navStyle(isActive)}>
        🐶 Pacientes
      </NavLink>
      <NavLink to="/inventory" style={({ isActive }) => navStyle(isActive)}>
        📦 Inventario
      </NavLink>

      {hasPro && (
        <NavLink to="/services" style={({ isActive }) => navStyle(isActive)}>
          🛠 Servicios
        </NavLink>
      )}
      {hasPro && (
        <NavLink to="/chat" style={({ isActive }) => navStyle(isActive)}>
          💬 Chat
        </NavLink>
      )}
      {hasPlus && (
        <NavLink to="/finance" style={({ isActive }) => navStyle(isActive)}>
          💰 Finanzas
        </NavLink>
      )}

      <div style={{ marginTop: 'auto' }}>
        <NavLink to="/settings" style={({ isActive }) => navStyle(isActive)}>
          ⚙️ Ajustes
        </NavLink>
        <a
          href="https://lumi-app-indol.vercel.app"
          target="_blank"
          rel="noreferrer"
          style={navStyle(false)}
        >
          🌐 Ir a Lumi App
        </a>
      </div>
    </aside>
  )
}
