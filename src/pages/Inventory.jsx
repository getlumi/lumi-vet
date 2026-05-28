import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATS = ['Todos','medicamento','vacuna','insumo','producto','alimento','juguete','accesorio','servicio']
const UNITS = ['pieza','caja','frasco','ml','kg','tableta','bolsa','lata','sobre']

export default function Inventory({ clinic }) {
  const [items, setItems]         = useState([])
  const [cat, setCat]             = useState('Todos')
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [saving, setSaving]       = useState(false)

  const emptyForm = {
    name:'', category:'medicamento', brand:'', unit:'pieza',
    stock:'', min_stock:'5', cost_price:'', sale_price:'',
    expiry_date:'', supplier:'', notes:'',
    is_bath_service: false,
    price_small:'', price_medium:'', price_large:'',
    small_max_kg:'10', medium_max_kg:'20', large_max_kg:'40',
    extra_1_name:'', extra_1_price:'',
    extra_2_name:'', extra_2_price:'',
    extra_3_name:'', extra_3_price:'',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    const { data, error } = await supabase.from('vet_inventory').select('*').eq('clinic_id', clinic.id).order('name')
    if (error) console.error('inventory error:', error.message)
    setItems(data || [])
  }

  const openAdd  = () => { setEditItem(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name:           item.name        || '',
      category:       item.category    || 'medicamento',
      brand:          item.brand       || '',
      unit:           item.unit        || 'pieza',
      stock:          String(item.stock      ?? ''),
      min_stock:      String(item.min_stock  ?? '5'),
      cost_price:     String(item.cost_price ?? ''),
      sale_price:     String(item.sale_price ?? ''),
      expiry_date:    item.expiry_date || '',
      supplier:       item.supplier   || '',
      notes:          item.notes      || '',
      is_bath_service: item.is_bath_service || false,
      price_small:    String(item.price_small  ?? ''),
      price_medium:   String(item.price_medium ?? ''),
      price_large:    String(item.price_large  ?? ''),
      small_max_kg:   String(item.small_max_kg  ?? '10'),
      medium_max_kg:  String(item.medium_max_kg ?? '20'),
      large_max_kg:   String(item.large_max_kg  ?? '40'),
      extra_1_name:   item.extra_1_name  || '',
      extra_1_price:  String(item.extra_1_price ?? ''),
      extra_2_name:   item.extra_2_name  || '',
      extra_2_price:  String(item.extra_2_price ?? ''),
      extra_3_name:   item.extra_3_name  || '',
      extra_3_price:  String(item.extra_3_price ?? ''),
    })
    setShowModal(true)
  }

  const saveItem = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const isBath = form.category === 'servicio' && form.is_bath_service
    const payload = {
      clinic_id:      clinic.id,
      name:           form.name.trim(),
      category:       form.category,
      brand:          form.brand.trim() || null,
      unit:           form.unit,
      stock:          form.category !== 'servicio' ? (parseFloat(form.stock) || 0) : 0,
      min_stock:      form.category !== 'servicio' ? (parseFloat(form.min_stock) || 0) : 0,
      cost_price:     form.cost_price  ? parseFloat(form.cost_price)  : null,
      sale_price:     form.sale_price  ? parseFloat(form.sale_price)  : null,
      expiry_date:    form.expiry_date || null,
      supplier:       form.supplier.trim() || null,
      notes:          form.notes.trim() || null,
      updated_at:     new Date().toISOString(),
      is_bath_service: isBath,
      price_small:    isBath && form.price_small  ? parseFloat(form.price_small)  : null,
      price_medium:   isBath && form.price_medium ? parseFloat(form.price_medium) : null,
      price_large:    isBath && form.price_large  ? parseFloat(form.price_large)  : null,
      small_max_kg:   isBath ? (parseFloat(form.small_max_kg)  || 10) : null,
      medium_max_kg:  isBath ? (parseFloat(form.medium_max_kg) || 20) : null,
      large_max_kg:   isBath ? (parseFloat(form.large_max_kg)  || 40) : null,
      extra_1_name:   isBath ? form.extra_1_name.trim()  || null : null,
      extra_1_price:  isBath && form.extra_1_price ? parseFloat(form.extra_1_price) : null,
      extra_2_name:   isBath ? form.extra_2_name.trim()  || null : null,
      extra_2_price:  isBath && form.extra_2_price ? parseFloat(form.extra_2_price) : null,
      extra_3_name:   isBath ? form.extra_3_name.trim()  || null : null,
      extra_3_price:  isBath && form.extra_3_price ? parseFloat(form.extra_3_price) : null,
    }
    let error
    if (editItem) {
      const res = await supabase.from('vet_inventory').update(payload).eq('id', editItem.id)
      error = res.error
    } else {
      const res = await supabase.from('vet_inventory').insert(payload)
      error = res.error
    }
    setSaving(false)
    if (error) { console.error('save error:', error.message); return }
    fetchItems(); setShowModal(false)
  }

  const deleteItem = async (id) => {
    if (!confirm('¿Eliminar producto?')) return
    await supabase.from('vet_inventory').delete().eq('id', id)
    fetchItems()
  }

  const filtered = items.filter(i =>
    (cat === 'Todos' || i.category === cat) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  )
  const lowStock = items.filter(i => i.category !== 'servicio' && i.stock <= i.min_stock).length
  const isBathForm = form.category === 'servicio' && form.is_bath_service

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <p style={{ fontSize:20, fontWeight:800, margin:'0 0 4px' }}>Inventario</p>
          {lowStock > 0 && <span className="badge badge-red"><i className="ti ti-alert-triangle" /> {lowStock} producto{lowStock>1?'s':''} con bajo stock</span>}
        </div>
        <button className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus" /> Agregar</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <input className="input" style={{ maxWidth:260 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar..." />
        {CATS.map(c => (
          <button key={c} className={`btn ${cat===c?'btn-primary':'btn-secondary'} btn-sm`} onClick={() => setCat(c)} style={{ textTransform:'capitalize' }}>{c}</button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <i className="ti ti-package" style={{ fontSize:40, color:'var(--text-muted)', display:'block', marginBottom:12 }} />
            <p style={{ fontSize:15, fontWeight:700, margin:'0 0 6px' }}>Sin productos</p>
            <button className="btn btn-primary" onClick={openAdd}>+ Agregar primero</button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Precio costo</th><th>Precio venta</th><th>Vencimiento</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    <p style={{ fontWeight:700, margin:'0 0 2px' }}>{item.name}</p>
                    <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>
                      {item.is_bath_service ? `🛁 Chico $${item.price_small||'—'} · Mediano $${item.price_medium||'—'} · Grande $${item.price_large||'—'}` : `${item.brand} · ${item.unit}`}
                    </p>
                  </td>
                  <td>
                    <span className="badge badge-purple" style={{ textTransform:'capitalize' }}>{item.category}</span>
                    {item.is_bath_service && <span className="badge badge-amber" style={{ marginLeft:4 }}>Baño</span>}
                  </td>
                  <td>
                    {item.category === 'servicio' ? (
                      <span className="badge badge-purple">Servicio</span>
                    ) : (
                      <span className={`badge ${item.stock<=item.min_stock?'badge-red':item.stock<=item.min_stock*2?'badge-amber':'badge-green'}`}>
                        {item.stock} {item.unit}
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight:600 }}>{item.cost_price ? `$${item.cost_price}` : '—'}</td>
                  <td style={{ fontWeight:600, color:'var(--purple)' }}>{item.sale_price ? `$${item.sale_price}` : '—'}</td>
                  <td style={{ color: item.expiry_date && new Date(item.expiry_date) < new Date() ? 'var(--red)' : 'inherit' }}>
                    {item.expiry_date ? new Date(item.expiry_date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(item)}><i className="ti ti-pencil" /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteItem(item.id)}><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth:560, maxHeight:'88vh', overflowY:'auto' }}>
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>{editItem ? 'Editar' : 'Nuevo'} producto / servicio</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="grid-2">
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Nombre *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Baño completo, Amoxicilina..." />
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value,is_bath_service:false}))}>
                    {CATS.filter(c=>c!=='Todos').map(c => <option key={c} value={c} style={{ textTransform:'capitalize' }}>{c}</option>)}
                  </select>
                </div>
                {form.category !== 'servicio' && (
                  <div>
                    <label className="label">Unidad</label>
                    <select className="input" value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                )}
                {form.category !== 'servicio' && (<>
                  <div>
                    <label className="label">Stock actual</label>
                    <input className="input" type="number" value={form.stock} onChange={e => setForm(f=>({...f,stock:e.target.value}))} placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Stock mínimo</label>
                    <input className="input" type="number" value={form.min_stock} onChange={e => setForm(f=>({...f,min_stock:e.target.value}))} placeholder="5" />
                  </div>
                </>)}

                {/* Precio general (para servicios no-baño) */}
                {!(form.category === 'servicio' && form.is_bath_service) && (<>
                  <div>
                    <label className="label">Precio costo</label>
                    <input className="input" type="number" value={form.cost_price} onChange={e => setForm(f=>({...f,cost_price:e.target.value}))} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="label">Precio venta</label>
                    <input className="input" type="number" value={form.sale_price} onChange={e => setForm(f=>({...f,sale_price:e.target.value}))} placeholder="0.00" />
                  </div>
                </>)}

                {form.category !== 'servicio' && (<>
                  <div>
                    <label className="label">Marca</label>
                    <input className="input" value={form.brand} onChange={e => setForm(f=>({...f,brand:e.target.value}))} placeholder="Pfizer..." />
                  </div>
                  <div>
                    <label className="label">Vencimiento</label>
                    <input className="input" type="date" value={form.expiry_date} onChange={e => setForm(f=>({...f,expiry_date:e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Proveedor</label>
                    <input className="input" value={form.supplier} onChange={e => setForm(f=>({...f,supplier:e.target.value}))} placeholder="Nombre del proveedor..." />
                  </div>
                </>)}

                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Notas</label>
                  <input className="input" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Observaciones..." />
                </div>
              </div>

              {/* Toggle servicio de baño */}
              {form.category === 'servicio' && (
                <div style={{ background:'var(--purple-lighter)', borderRadius:12, padding:14 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <input type="checkbox" checked={form.is_bath_service} onChange={e => setForm(f=>({...f,is_bath_service:e.target.checked}))} style={{ width:18, height:18, accentColor:'var(--purple)' }} />
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:'var(--purple)', margin:0 }}>🛁 Este es un servicio de baño</p>
                      <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>Activa precios por talla y extras</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Panel de baño */}
              {isBathForm && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

                  {/* Rangos de peso */}
                  <div style={{ background:'var(--bg)', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>Rangos de talla (kg)</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      <div>
                        <label className="label">Chico hasta (kg)</label>
                        <input className="input" type="number" value={form.small_max_kg} onChange={e => setForm(f=>({...f,small_max_kg:e.target.value}))} placeholder="10" />
                      </div>
                      <div>
                        <label className="label">Mediano hasta (kg)</label>
                        <input className="input" type="number" value={form.medium_max_kg} onChange={e => setForm(f=>({...f,medium_max_kg:e.target.value}))} placeholder="20" />
                      </div>
                      <div>
                        <label className="label">Grande hasta (kg)</label>
                        <input className="input" type="number" value={form.large_max_kg} onChange={e => setForm(f=>({...f,large_max_kg:e.target.value}))} placeholder="40" />
                      </div>
                    </div>
                  </div>

                  {/* Precios por talla */}
                  <div style={{ background:'var(--bg)', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>Precios por talla</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      <div>
                        <label className="label">🐕 Chico</label>
                        <input className="input" type="number" value={form.price_small} onChange={e => setForm(f=>({...f,price_small:e.target.value}))} placeholder="150" />
                      </div>
                      <div>
                        <label className="label">🐕 Mediano</label>
                        <input className="input" type="number" value={form.price_medium} onChange={e => setForm(f=>({...f,price_medium:e.target.value}))} placeholder="200" />
                      </div>
                      <div>
                        <label className="label">🐕 Grande</label>
                        <input className="input" type="number" value={form.price_large} onChange={e => setForm(f=>({...f,price_large:e.target.value}))} placeholder="250" />
                      </div>
                    </div>
                  </div>

                  {/* Extras */}
                  <div style={{ background:'var(--bg)', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>Extras (opcional)</p>
                    {[1,2,3].map(n => (
                      <div key={n} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:8 }}>
                        <input className="input" value={form[`extra_${n}_name`]} onChange={e => setForm(f=>({...f,[`extra_${n}_name`]:e.target.value}))} placeholder={`Extra ${n} — ej: Perfume, Moño, Corte de uñas`} />
                        <input className="input" type="number" value={form[`extra_${n}_price`]} onChange={e => setForm(f=>({...f,[`extra_${n}_price`]:e.target.value}))} placeholder="$0" style={{ width:80 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveItem} disabled={!form.name.trim() || saving} style={{ flex:2, justifyContent:'center' }}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
