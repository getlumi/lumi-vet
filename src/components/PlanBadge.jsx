import { useVet } from '../context/VetContext'

const PLANS = {
  basico: { label: 'Básico', color: '#64748b' },
  pro:    { label: 'Pro ⭐', color: '#7c3aed' },
  plus:   { label: 'Plus 💎', color: '#0ea5e9' },
}

export default function PlanBadge() {
  const { plan } = useVet()
  const { label, color } = PLANS[plan] || PLANS.basico

  return (
    <span style={{
      background: color,
      color: '#fff',
      fontSize: '11px',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: '999px',
    }}>
      {label}
    </span>
  )
}
