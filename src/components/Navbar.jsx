import { useAuth } from '../context/AuthContext'
import { useVet } from '../context/VetContext'
import PlanBadge from './PlanBadge'

export default function Navbar({ title = 'Lumi Vet' }) {
  const { user, signOut } = useAuth()
  const { clinic } = useVet()

  return (
    <header style={{
      height: '56px',
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '15px' }}>{clinic?.name || title}</span>
        <PlanBadge />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: '#64748b' }}>{user?.email}</span>
        <button
          onClick={signOut}
          style={{
            fontSize: '12px', padding: '6px 12px',
            borderRadius: '6px', border: '1px solid #e2e8f0',
            background: 'none', cursor: 'pointer', color: '#64748b',
          }}
        >
          Salir
        </button>
      </div>
    </header>
  )
}
