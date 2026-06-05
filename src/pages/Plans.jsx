import React from 'react'
import { PLANS_DEF } from '../App'

const CHECK = ({ ok }) => (
  <span style={{ fontSize:14, fontWeight:700, color: ok ? '#16A34A' : '#D1D5DB' }}>
    {ok ? '✓' : '—'}
  </span>
)

export default function Plans({ currentPlan, clinic, onNavigate }) {
  const formatPrice = (n) => `$${n.toLocaleString('es-MX')}/mes`

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 4px' }}>Lumi Vet</p>
        <p style={{ fontSize:24, fontWeight:700, color:'var(--purple-dark)', margin:'0 0 6px', letterSpacing:'-0.3px' }}>Planes y precios</p>
        <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>
          Plan actual: <strong style={{ color:'var(--purple)' }}>{PLANS_DEF[currentPlan]?.label} {PLANS_DEF[currentPlan]?.emoji}</strong>
        </p>
      </div>

      {/* Cards de planes */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:32 }}>
        {['basic','pro','plus'].map(planId => {
          const p = PLANS_DEF[planId]
          const isCurrent    = currentPlan === planId
          const isRecommended = planId === 'pro'
          return (
            <div key={planId} style={{
              borderRadius:18, border:`2px solid ${isCurrent ? p.color : isRecommended ? p.color : 'var(--border)'}`,
              background: isCurrent ? `${p.color}08` : 'white',
              padding:24, position:'relative', overflow:'hidden',
            }}>
              {isRecommended && !isCurrent && (
                <div style={{ position:'absolute', top:14, right:14, background:'linear-gradient(135deg,#6B21A8,#C026D3)', borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:800, color:'white' }}>
                  MÁS POPULAR
                </div>
              )}
              {isCurrent && (
                <div style={{ position:'absolute', top:14, right:14, background:'#DCFCE7', borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:800, color:'#16A34A' }}>
                  ✓ TU PLAN
                </div>
              )}
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:22, margin:'0 0 4px' }}>{p.emoji || '🐾'}</p>
                <p style={{ fontSize:18, fontWeight:800, color:p.color, margin:'0 0 4px' }}>{p.label}</p>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 12px' }}>{p.description}</p>
                <p style={{ fontSize:28, fontWeight:900, color:'var(--text-primary)', margin:0 }}>
                  {formatPrice(p.price)}
                </p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                {p.features.map((f,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                    <span style={{ fontSize:12, color:'#16A34A', fontWeight:800, flexShrink:0, marginTop:1 }}>✓</span>
                    <span style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.4 }}>{f}</span>
                  </div>
                ))}
                {p.notIncluded.map((f,i) => (
                  <div key={`no-${i}`} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                    <span style={{ fontSize:12, color:'#D1D5DB', fontWeight:800, flexShrink:0, marginTop:1 }}>—</span>
                    <span style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              {!isCurrent ? (
                <button
                  onClick={() => onNavigate && onNavigate('soporte')}
                  style={{
                    width:'100%', padding:'12px', borderRadius:12, border:'none',
                    background: isRecommended ? `linear-gradient(135deg,${p.color},#C026D3)` : `${p.color}15`,
                    color: isRecommended ? 'white' : p.color,
                    fontSize:13, fontWeight:800, cursor:'pointer',
                  }}>
                  Solicitar cambio a {p.label}
                </button>
              ) : (
                <div style={{ padding:'10px', borderRadius:12, background:'#DCFCE7', textAlign:'center', fontSize:13, fontWeight:700, color:'#16A34A' }}>
                  Plan activo ✓
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Nota cambio de plan — solo Soporte interno, sin correo */}
      <div style={{ background:'#F5F3FF', border:'1px solid #DDD6FE', borderRadius:14, padding:'14px 18px', marginBottom:24, display:'flex', alignItems:'center', gap:14 }}>
        <i className="ti ti-message-circle" style={{ fontSize:22, color:'var(--purple)', flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:700, color:'var(--purple)', margin:'0 0 2px' }}>¿Quieres cambiar de plan?</p>
          <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0 }}>Escríbenos desde Soporte Lumi y te ayudamos a migrar sin perder tus datos.</p>
        </div>
        <button
          onClick={() => onNavigate && onNavigate('soporte')}
          style={{ background:'var(--purple)', border:'none', borderRadius:10, padding:'10px 16px', color:'white', fontSize:13, fontWeight:800, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
          <i className="ti ti-send" style={{ fontSize:14 }} />
          Ir a Soporte
        </button>
      </div>

      {/* Add-ons con Bot */}
      <div className="card" style={{ marginBottom:24 }}>
        <p style={{ fontSize:15, fontWeight:800, margin:'0 0 4px' }}>🤖 Add-on — Bot IA personalizado</p>
        <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 20px' }}>
          Agrega un chatbot de WhatsApp con inteligencia artificial personalizado a tu clínica. El bot agenda citas, responde preguntas y se sincroniza con tu agenda Lumi Vet.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {['basic_bot','plus_bot'].map(planId => {
            const p = PLANS_DEF[planId]
            const isCurrent = currentPlan === planId
            return (
              <div key={planId} style={{ borderRadius:14, border:`2px solid ${isCurrent ? '#16A34A' : p.color+'40'}`, padding:18, background: isCurrent ? '#F0FDF4' : 'white' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <p style={{ fontSize:15, fontWeight:800, color:p.color, margin:'0 0 2px' }}>{p.label}</p>
                    <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0 }}>{p.description}</p>
                  </div>
                  {isCurrent && <span style={{ fontSize:10, fontWeight:800, background:'#DCFCE7', color:'#16A34A', borderRadius:10, padding:'2px 8px' }}>ACTIVO</span>}
                </div>
                <p style={{ fontSize:22, fontWeight:900, color:'var(--text-primary)', margin:'0 0 4px' }}>{formatPrice(p.price)}</p>
                <p style={{ fontSize:11, color:'var(--text-muted)', margin:'0 0 14px' }}>+ $1,500 setup único de personalización</p>
                <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
                  {p.features.slice(0,4).map((f,i) => (
                    <div key={i} style={{ display:'flex', gap:8 }}>
                      <span style={{ fontSize:11, color:'#16A34A', fontWeight:800, flexShrink:0 }}>✓</span>
                      <span style={{ fontSize:11, color:'var(--text-primary)' }}>{f}</span>
                    </div>
                  ))}
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => onNavigate && onNavigate('soporte')}
                    style={{ width:'100%', padding:'10px', borderRadius:10, border:`1.5px solid ${p.color}`, background:'white', color:p.color, fontSize:12, fontWeight:800, cursor:'pointer' }}>
                    Solicitar Bot IA
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabla comparativa completa */}
      <div className="card">
        <p style={{ fontSize:15, fontWeight:800, margin:'0 0 20px' }}>Comparativa completa</p>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'10px 12px', borderBottom:'2px solid var(--border)', color:'var(--text-secondary)', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px' }}>Función</th>
                {['basic','basic_bot','pro','plus','plus_bot'].map(planId => {
                  const p = PLANS_DEF[planId]
                  const isCurrent = currentPlan === planId
                  return (
                    <th key={planId} style={{ textAlign:'center', padding:'10px 12px', borderBottom:'2px solid var(--border)', minWidth:90 }}>
                      <p style={{ fontSize:12, fontWeight:800, color: isCurrent ? p.color : 'var(--text-primary)', margin:'0 0 2px' }}>{p.label} {p.emoji}</p>
                      <p style={{ fontSize:11, color:'var(--text-muted)', margin:0, fontWeight:600 }}>${p.price}/mes</p>
                      {isCurrent && <span style={{ fontSize:9, background:'#DCFCE7', color:'#16A34A', borderRadius:8, padding:'1px 6px', fontWeight:800 }}>ACTIVO</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[
                { label:'Perfil en mapa Lumi ✦',            vals:[1,1,1,1,1] },
                { label:'Agenda — pacientes Lumi',           vals:[1,1,1,1,1] },
                { label:'Carnet + certificado de salud',     vals:[1,1,1,1,1] },
                { label:'Visita walk-in Lumi',               vals:[1,1,1,1,1] },
                { label:'Historial clínico Lumi',            vals:[1,1,1,1,1] },
                { label:'Historial visible en Lumi App',     vals:[1,1,1,1,1] },
                { label:'Recibir solicitudes de cita',       vals:[1,1,1,1,1] },
                { label:'─── Plan Pro ───', section:true },
                { label:'Pacientes regulares (sin Lumi)',    vals:[0,0,1,1,1] },
                { label:'Historial clínico SOAP',            vals:[0,0,1,1,1] },
                { label:'Servicios configurables',           vals:[0,0,1,1,1] },
                { label:'Inventario con stock',              vals:[0,0,1,1,1] },
                { label:'Venta rápida',                      vals:[0,0,1,1,1] },
                { label:'Chat con clientes',                 vals:[0,0,1,1,1] },
                { label:'─── Plan Plus ───', section:true },
                { label:'Panel Admin Global',                vals:[0,0,0,1,1] },
                { label:'Finanzas y cortes diarios',         vals:[0,0,0,1,1] },
                { label:'Reportes mensuales y anuales',      vals:[0,0,0,1,1] },
                { label:'Métricas avanzadas',                vals:[0,0,0,1,1] },
                { label:'─── Bot IA ───', section:true },
                { label:'Chatbot WhatsApp personalizado',    vals:[0,1,0,0,1] },
                { label:'Agenda sincronizada con bot',       vals:[0,1,0,0,1] },
                { label:'Métricas del bot',                  vals:[0,1,0,0,1] },
                { label:'─── Publicidad en Lumi App ───', section:true },
                { label:'Anuncios semanales',                vals:['2','2','4','8','8'] },
                { label:'Presencia en otras secciones',      vals:[0,0,1,1,1] },
                { label:'Patrocinio premium',                vals:[0,0,0,1,1] },
              ].map((row, i) => {
                if (row.section) return (
                  <tr key={i}>
                    <td colSpan={6} style={{ padding:'14px 12px 6px', fontSize:11, fontWeight:800, color:'var(--purple)', textTransform:'uppercase', letterSpacing:'0.7px', borderTop:'1px solid var(--border)' }}>
                      {row.label}
                    </td>
                  </tr>
                )
                return (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 12px', color:'var(--text-primary)', fontWeight:500 }}>{row.label}</td>
                    {row.vals.map((v, j) => (
                      <td key={j} style={{ textAlign:'center', padding:'10px 12px' }}>
                        {typeof v === 'string'
                          ? <span style={{ fontSize:13, fontWeight:700, color:'var(--purple)' }}>{v}/sem</span>
                          : <CHECK ok={v === 1} />}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer — solo Soporte, sin correo */}
      <div style={{ marginTop:24, padding:'20px 24px', background:'linear-gradient(135deg,#1A0A2E,#3B0764)', borderRadius:18, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <div>
          <p style={{ fontSize:15, fontWeight:800, color:'white', margin:'0 0 4px' }}>¿Tienes dudas sobre los planes?</p>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.6)', margin:0 }}>Escríbenos directamente desde Soporte Lumi y te respondemos a la brevedad.</p>
        </div>
        <button
          onClick={() => onNavigate && onNavigate('soporte')}
          style={{ background:'white', borderRadius:12, padding:'12px 20px', fontSize:13, fontWeight:800, color:'#6B21A8', border:'none', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
          <i className="ti ti-message-circle" style={{ fontSize:16 }} />
          Abrir Soporte
        </button>
      </div>
    </div>
  )
}
