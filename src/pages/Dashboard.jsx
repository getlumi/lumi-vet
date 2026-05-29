import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard({ clinic, session, onNavigate }) {
  const [stats, setStats]     = useState({ appointments:0, patients:0, pendingAppts:0 })
  const [today, setToday]     = useState([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel]     = useState(null)
  const [panelData, setPanelData] = useState([])
  const [panelLoading, setPanelLoading] = useState(false)
  const [ranking, setRanking] = useState({ avg: 0, count: 0 })
  const [showQuickSale, setShowQuickSale] = useState(false)
  const [quickCart, setQuickCart] = useState([])
  const [quickInventory, setQuickInventory] = useState([])
  const [quickServices, setQuickServices] = useState([])
  const [quickTab, setQuickTab] = useState('productos')
  const [quickSearch, setQuickSearch] = useState('')
  const [quickClient, setQuickClient] = useState({ name: '', phone: '' })
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickSuccess, setQuickSuccess] = useState(false)

  useEffect(() => { fetchAll() }, [clinic])

  const fetchAll = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0,10)
      const [apptRes, lumiRes, regularRes, todayRes, pendingRes] = await Promise.all([
        supabase.from('vet_appointments').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
        supabase.from('vet_patients').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
        supabase.from('vet_regular_patients').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
        supabase.from('vet_appointments').select('*, pets(name,photo_url)').eq('clinic_id', clinic.id).eq('date', todayStr).order('time'),
        supabase.from('vet_appointments').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id).eq('status','pending'),
      ])
      setStats({
        appointments: apptRes.count || 0,
        patients:     (lumiRes.count || 0) + (regularRes.count || 0),
        pendingAppts: pendingRes.count || 0,
      })
      setToday(todayRes.data || [])

      // Cargar inventario (solo productos) para venta rápida
      const { data: inv } = await supabase
        .from('vet_inventory')
        .select('id,name,unit,sale_price,stock,category')
        .eq('clinic_id', clinic.id)
        .not('category', 'eq', 'servicio')
        .order('name')
      setQuickInventory(inv || [])

      // Cargar servicios para venta rápida
      const { data: svcs } = await supabase
        .from('vet_services')
        .select('id,name,price,category,is_bath_service,price_small,price_medium,price_large')
        .eq('clinic_id', clinic.id)
        .eq('is_active', true)
        .order('name')
      setQuickServices(svcs || [])

      // Ranking de la clínica
      const { data: reviews } = await supabase
        .from('vet_reviews').select('rating').eq('clinic_id', clinic.id)
      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        setRanking({ avg: avg.toFixed(1), count: reviews.length })
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const addToQuickCart = (item) => {
    setQuickCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const updateQuickQty = (id, qty) => {
    if (qty <= 0) { setQuickCart(prev => prev.filter(c => c.id !== id)); return }
    setQuickCart(prev => prev.map(c => c.id === id ? { ...c, qty } : c))
  }

  const quickTotal = quickCart.reduce((sum, c) => sum + (c.sale_price || 0) * c.qty, 0)

  const saveQuickSale = async () => {
    if (quickCart.length === 0) return
    setQuickSaving(true)
    const today = new Date().toISOString().slice(0,10)
    try {
      const clientNote = quickClient.name ? ' — ' + quickClient.name + (quickClient.phone ? ' ' + quickClient.phone : '') : ''
      for (const item of quickCart) {
        await supabase.from('vet_transactions').insert({
          clinic_id:   clinic.id,
          type:        'income',
          category:    item._type || 'producto',
          description: item.name + ' x' + item.qty + clientNote,
          amount:      (item.sale_price || 0) * item.qty,
          date:        today,
        })
        // Descontar stock solo si es producto
        if (item._type !== 'servicio' && item.stock > 0) {
          await supabase.from('vet_inventory')
            .update({ stock: Math.max(0, item.stock - item.qty) })
            .eq('id', item.id)
        }
      }
      setQuickSuccess(true)
      setTimeout(() => {
        setQuickSuccess(false)
        setShowQuickSale(false)
        setQuickCart([])
        setQuickClient({ name: '', phone: '' })
        setQuickSearch('')
        setQuickTab('productos')
        fetchAll()
      }, 2000)
    } catch(e) { console.error(e) }
    finally { setQuickSaving(false) }
  }

  const openPanel = async (type) => {
    setPanel(type)
    setPanelLoading(true)
    let query = supabase
      .from('vet_appointments')
      .select('*, pets(name,photo_url)')
      .eq('clinic_id', clinic.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    if (type === 'pending') query = query.eq('status', 'pending')
    const { data } = await query
    setPanelData(data || [])
    setPanelLoading(false)
  }

  const todayStr = new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })
  const plan = clinic.plan || 'basic'

  const statusLabel = (s) => s==='confirmed'?'Confirmada':s==='completed'?'Completada':s==='cancelled'?'Cancelada':'Pendiente'
  const statusClass = (s) => s==='confirmed'?'badge-green':s==='completed'?'badge-purple':s==='cancelled'?'badge-red':'badge-amber'
  const isToday = (d) => d === new Date().toISOString().slice(0,10)
  const formatDate = (d) => {
    if (isToday(d)) return 'Hoy'
    return new Date(d+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'})
  }

  return (
    <div>
      <div style={{ marginBottom:28, paddingTop:4, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
        <p style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', letterSpacing:'0.3px', margin:'0 0 6px', textTransform:'capitalize' }}>{todayStr}</p>
        <p style={{ fontSize:24, fontWeight:700, color:'var(--purple-dark)', margin:0, letterSpacing:'-0.3px', lineHeight:1.3 }}>
          Buenos días 👋
        </p>
      </div>

      <div className="grid-4" style={{ marginBottom:24 }}>
        {[
          { icon:'ti-calendar-check', label:'Citas hoy',   value: today.length,        color:'#EDE9FE', iconColor:'#6B21A8', action: () => onNavigate('appointments') },
          { icon:'ti-clock',          label:'Pendientes',  value: stats.pendingAppts,  color:'#FEF3C7', iconColor:'#D97706', action: () => openPanel('pending') },
          { icon:'ti-paw',            label:'Pacientes',   value: stats.patients,      color:'#DCFCE7', iconColor:'#16A34A', action: () => onNavigate('patients') },
          { icon:'ti-calendar',       label:'Total citas', value: stats.appointments,  color:'#FCE7F3', iconColor:'#DB2777', action: () => openPanel('all') },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor:'pointer' }} onClick={s.action}>
            <div className="stat-icon" style={{ background:s.color }}>
              <i className={`ti ${s.icon}`} style={{ color:s.iconColor }} />
            </div>
            <div>
              <p style={{ fontSize:24, fontWeight:900, color:'var(--text-primary)', margin:'0 0 2px' }}>{s.value}</p>
              <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0, fontWeight:600 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Ranking */}
      {ranking.count > 0 && (
        <div style={{ background:'linear-gradient(135deg,#F59E0B,#D97706)', borderRadius:14, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.8)', margin:'0 0 4px', fontWeight:600 }}>Calificación de tu clínica</p>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:28, fontWeight:900, color:'white' }}>{ranking.avg}</span>
              <div>
                <div style={{ display:'flex', gap:2 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize:14, color: s <= Math.round(ranking.avg) ? 'white' : 'rgba(255,255,255,0.3)' }}>★</span>
                  ))}
                </div>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', margin:0 }}>{ranking.count} {ranking.count===1?'calificación':'calificaciones'}</p>
              </div>
            </div>
          </div>
          <i className="ti ti-star-filled" style={{ fontSize:40, color:'rgba(255,255,255,0.3)' }} />
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <p style={{ fontSize:15, fontWeight:800, margin:0 }}>Citas de hoy</p>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('appointments')}><i className="ti ti-plus" /> Ver agenda</button>
          </div>
          {today.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)' }}>
              <i className="ti ti-calendar" style={{ fontSize:32, display:'block', marginBottom:8 }} />
              <p style={{ fontSize:13 }}>Sin citas para hoy</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {today.map(appt => (
                <div key={appt.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg)', borderRadius:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {appt.pets?.photo_url ? <img src={appt.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:10 }} /> : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:16 }} />}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:13, fontWeight:700, margin:'0 0 2px' }}>{appt.pets?.name || appt.pet_name || 'Mascota'}</p>
                    <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>{appt.time?.slice(0,5)} · {appt.notes || 'Consulta'}</p>
                  </div>
                  <span className={`badge ${statusClass(appt.status)}`}>{statusLabel(appt.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p style={{ fontSize:15, fontWeight:800, margin:'0 0 16px' }}>Accesos rápidos</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { icon:'ti-calendar-plus', label:'Nueva cita',     color:'#EDE9FE', iconColor:'#6B21A8', action:'appointments' },
              { icon:'ti-paw',           label:'Nuevo paciente', color:'#DCFCE7', iconColor:'#16A34A', action:'patients', plan:'pro' },
              { icon:'ti-package',       label:'Inventario',     color:'#FEF3C7', iconColor:'#D97706', action:'inventory', plan:'pro' },
              { icon:'ti-shopping-cart', label:'Venta rápida',   color:'#FEE2E2', iconColor:'#DC2626', action:'quick_sale', plan:'pro' },
            ].filter(a => !a.plan || plan===a.plan || (a.plan==='pro' && plan==='plus')).map(a => (
              <button key={a.label} onClick={() => a.action === 'quick_sale' ? setShowQuickSale(true) : onNavigate(a.action, a.label==='Nuevo paciente'?'new':null)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 12px', borderRadius:12, border:'1px solid var(--border)', background:a.color, cursor:'pointer', transition:'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                <i className={`ti ${a.icon}`} style={{ fontSize:22, color:a.iconColor }} />
                <span style={{ fontSize:12, fontWeight:700, color:'#374151', textAlign:'center' }}>{a.label}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop:16, padding:'12px', background:'linear-gradient(135deg,#6B21A8,#C026D3)', borderRadius:12 }}>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.8)', margin:'0 0 4px', fontWeight:600 }}>
              Plan {plan==='basic'?'Básico':plan==='pro'?'Pro ⭐':'Plus 💎'} activo
            </p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.6)', margin:0 }}>
              {plan==='basic'?'¿Necesitas más funciones? Actualiza a Pro':plan==='pro'?'Considera Plus para finanzas y IA':'Tienes acceso a todas las funciones'}
            </p>
          </div>
        </div>
      </div>

      {/* Panel lateral citas */}
      {panel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', justifyContent:'flex-end' }}
          onClick={e => e.target===e.currentTarget && setPanel(null)}>
          <div style={{ width:420, background:'white', height:'100%', overflowY:'auto', padding:24, boxShadow:'-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p style={{ fontSize:17, fontWeight:800, margin:0 }}>{panel==='pending'?'⏳ Citas pendientes':'📅 Todas las citas'}</p>
              <button className="btn btn-icon" onClick={() => setPanel(null)}><i className="ti ti-x" /></button>
            </div>
            {panelLoading ? <p style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>Cargando...</p>
            : panelData.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                <i className="ti ti-calendar" style={{ fontSize:36, display:'block', marginBottom:8 }} />
                <p>Sin citas {panel==='pending'?'pendientes':'registradas'}</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {panelData.map(appt => (
                  <div key={appt.id} style={{ padding:'12px 14px', borderRadius:12, border:'1px solid var(--border)', background: isToday(appt.date)?'#EDE9FE':'white', borderLeft: isToday(appt.date)?'3px solid #6B21A8':'3px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {appt.pets?.photo_url ? <img src={appt.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} /> : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:14 }} />}
                        </div>
                        <div>
                          <p style={{ fontSize:14, fontWeight:700, margin:0 }}>{appt.pets?.name || appt.pet_name || 'Mascota'}</p>
                          {appt.owner_name && <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Dueño: {appt.owner_name}</p>}
                        </div>
                      </div>
                      <span className={`badge ${statusClass(appt.status)}`}>{statusLabel(appt.status)}</span>
                    </div>
                    <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--text-secondary)' }}>
                      <span><i className="ti ti-calendar" style={{ marginRight:4 }} />{formatDate(appt.date)}</span>
                      <span><i className="ti ti-clock" style={{ marginRight:4 }} />{appt.time?.slice(0,5)}</span>
                      {appt.notes && <span>· {appt.notes}</span>}
                    </div>
                    {appt.price && <p style={{ fontSize:12, fontWeight:700, color:'var(--purple)', margin:'6px 0 0' }}>${appt.price}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL VENTA RÁPIDA */}
      {showQuickSale && (
        <div onClick={e => e.target === e.currentTarget && setShowQuickSale(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:480, maxHeight:'85vh', overflow:'auto', padding:20 }}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <p style={{ fontSize:17, fontWeight:800, margin:0 }}>🛒 Venta rápida</p>
              <button onClick={() => setShowQuickSale(false)} style={{ background:'var(--purple-light)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="ti ti-x" style={{ color:'var(--purple)', fontSize:16 }} />
              </button>
            </div>

            {quickSuccess ? (
              <div style={{ textAlign:'center', padding:'32px 0' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <p style={{ fontSize:18, fontWeight:800, color:'var(--purple)', margin:0 }}>¡Venta registrada!</p>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'8px 0 0' }}>Total: ${quickTotal.toFixed(2)}</p>
              </div>
            ) : (
              <>
                {/* Datos cliente (opcional) */}
                <div style={{ background:'var(--bg)', borderRadius:12, padding:12, marginBottom:14 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 8px' }}>Cliente (opcional)</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <input className="input" value={quickClient.name} onChange={e => setQuickClient(c => ({...c, name: e.target.value}))} placeholder="Nombre..." style={{ fontSize:13 }} />
                    <input className="input" value={quickClient.phone} onChange={e => setQuickClient(c => ({...c, phone: e.target.value}))} placeholder="Teléfono..." style={{ fontSize:13 }} type="tel" />
                  </div>
                </div>

                {/* Buscador de productos/servicios */}
                <input className="input" value={quickSearch} onChange={e => setQuickSearch(e.target.value)}
                  placeholder="🔍 Buscar producto o servicio..." style={{ marginBottom:10 }} />

                {/* Lista de inventario */}
                {/* Tabs productos / servicios */}
                <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                  {['productos','servicios'].map(t => (
                    <button key={t} onClick={() => { setQuickTab(t); setQuickSearch('') }}
                      className={quickTab===t?'btn btn-primary btn-sm':'btn btn-secondary btn-sm'}
                      style={{ textTransform:'capitalize', flex:1, justifyContent:'center' }}>
                      {t === 'productos' ? '📦 Productos' : '🛠 Servicios'}
                    </button>
                  ))}
                </div>

                <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                  {quickTab === 'productos' ? (
                    quickInventory
                      .filter(i => i.stock > 0 && i.name.toLowerCase().includes(quickSearch.toLowerCase()))
                      .map(item => (
                        <div key={item.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg)', borderRadius:8 }}>
                          <div>
                            <p style={{ fontSize:13, fontWeight:600, margin:'0 0 2px' }}>{item.name}</p>
                            <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>📦 Stock: {item.stock} · ${item.sale_price || 0}</p>
                          </div>
                          <button onClick={() => addToQuickCart({...item, _type:'producto'})} className="btn btn-primary btn-sm">+ Agregar</button>
                        </div>
                      ))
                  ) : (
                    quickServices
                      .filter(s => s.name.toLowerCase().includes(quickSearch.toLowerCase()))
                      .map(svc => (
                        <div key={svc.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg)', borderRadius:8 }}>
                          <div>
                            <p style={{ fontSize:13, fontWeight:600, margin:'0 0 2px' }}>{svc.name}</p>
                            <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>
                              🛠 Servicio · {svc.is_bath_service ? `$${svc.price_small||0}–$${svc.price_large||0}` : `$${svc.price||0}`}
                            </p>
                          </div>
                          <button onClick={() => addToQuickCart({...svc, sale_price: svc.price, _type:'servicio'})} className="btn btn-primary btn-sm">+ Agregar</button>
                        </div>
                      ))
                  )}
                </div>

                {/* Carrito */}
                {quickCart.length > 0 && (
                  <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:12, marginBottom:14 }}>
                    <p style={{ fontSize:13, fontWeight:700, margin:'0 0 10px' }}>🛒 Carrito</p>
                    {quickCart.map(c => (
                      <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <p style={{ fontSize:13, flex:1, margin:0 }}>{c.name}</p>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <button onClick={() => updateQuickQty(c.id, c.qty-1)} style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--border)', background:'white', cursor:'pointer', fontWeight:700 }}>−</button>
                          <span style={{ fontSize:13, fontWeight:700, minWidth:20, textAlign:'center' }}>{c.qty}</span>
                          <button onClick={() => updateQuickQty(c.id, c.qty+1)} style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--border)', background:'white', cursor:'pointer', fontWeight:700 }}>+</button>
                        </div>
                        <p style={{ fontSize:13, fontWeight:700, color:'var(--purple)', margin:0, minWidth:60, textAlign:'right' }}>${((c.sale_price||0)*c.qty).toFixed(2)}</p>
                      </div>
                    ))}
                    <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between' }}>
                      <p style={{ fontSize:13, fontWeight:700, margin:0 }}>Total</p>
                      <p style={{ fontSize:16, fontWeight:900, color:'var(--purple)', margin:0 }}>${quickTotal.toFixed(2)}</p>
                    </div>
                  </div>
                )}

                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setShowQuickSale(false)} className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                  <button onClick={saveQuickSale} disabled={quickCart.length === 0 || quickSaving}
                    className="btn btn-primary" style={{ flex:2, justifyContent:'center', background:'linear-gradient(135deg,#DC2626,#EF4444)' }}>
                    <i className="ti ti-shopping-cart" style={{ fontSize:16 }} />
                    {quickSaving ? 'Guardando...' : `Cobrar $${quickTotal.toFixed(2)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
