import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATS = ['Todos','medicamento','vacuna','insumo','producto','alimento','juguete','accesorio']
const UNITS = ['pieza','caja','frasco','ml','kg','tableta','bolsa','lata','sobre']

export default function Inventory({ clinic }) {
  const [items, setItems]         = useState([])
  const [cat, setCat]             = useState('Todos')
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [saving, setSaving]       = useState(false)
  const emptyForm = { name:'', category:'medicamento', brand:'', unit:'pieza', stock:'', min_stock:'5', cost_price:'', sale_price:'', expiry_date:'', supplier:'', notes:'' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('vet_inventory')
      .select('*')
      .eq('clinic_id', clinic.id)
      .order('name')
    if (error) console.error('inventory error:', error.message)
    setItems(data || [])
  }

  const openAdd  = () => { setEditItem(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name:        item.name        || '',
      category:    item.category    || 'medicamento',
      brand:       item.brand       || '',
      unit:        item.unit        || 'pieza',
      stock:       String(item.stock    ?? ''),
      min_stock:   String(item.min_stock ?? '5'),
      cost_price:  String(item.cost_price ?? ''),
      sale_price:  String(item.sale_price ?? ''),
      expiry_date: item.expiry_date || '',
      supplier:    item.supplier    || '',
      notes:       item.notes       || '',
    })
    setShowModal(true)
  }

  const saveItem = async () => {
    if (!form.name.trim()) return
    setSaving(true)

    const payload = {
      clinic_id:   clinic.id,
      name:        form.name.trim(),
      category:    form.category,
      brand:       form.brand.trim(),
      unit:        form.unit,
      stock:       parseFloat(form.stock)      || 0,
      min_stock:   parseFloat(form.min_stock)  || 0,
      cost_price:  form.cost_price  ? parseFloat(form.cost_price)  : null,
      sale_price:  form.sale_price  ? parseFloat(form.sale_price)  : null,
      expiry_date: form.expiry_date || null,
      supplier:    form.supplier.trim() || null,
      notes:       form.notes.trim()    || null,
      updated_at:  new Date().toISOString(),
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
    fetchItems()
    setShowModal(false)
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

  const lowStock = items.filter(i => i.stock <= i.min_stock).length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <p style={{ fontSize:20, fontWeight:800, margin:'0 0 4px' }}>Inventario</p>
          {lowStock > 0 && <span className="badge badge-red"><i className="ti ti-alert-triangle" /> {lowStock} producto{lowStock>1?'s':''} con bajo stock</span>}
        </div>
        <button className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus" /> Agregar producto</button>
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
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Stock</th>
                <th>Precio costo</th>
                <th>Precio venta</th>
                <th>Vencimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    <p style={{ fontWeight:700, margin:'0 0 2px' }}>{item.name}</p>
                    <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{item.brand} · {item.unit}</p>
                  </td>
                  <td><span className="badge badge-purple" style={{ textTransform:'capitalize' }}>{item.category}</span></td>
                  <td>
                    <span className={`badge ${item.stock<=item.min_stock?'badge-red':item.stock<=item.min_stock*2?'badge-amber':'badge-green'}`}>
                      {item.stock} {item.unit}
                    </span>
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
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>{editItem ? 'Editar producto' : 'Nuevo producto'}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="grid-2">
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Nombre *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Amoxicilina 500mg" />
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {CATS.filter(c=>c!=='Todos').map(c => <option key={c} value={c} style={{ textTransform:'capitalize' }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Unidad</label>
                  <select className="input" value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Stock actual</label>
                  <input className="input" type="number" value={form.stock} onChange={e => setForm(f=>({...f,stock:e.target.value}))} placeholder="0" />
                </div>
                <div>
                  <label className="label">Stock mínimo</label>
                  <input className="input" type="number" value={form.min_stock} onChange={e => setForm(f=>({...f,min_stock:e.target.value}))} placeholder="5" />
                </div>
                <div>
                  <label className="label">Precio costo</label>
                  <input className="input" type="number" value={form.cost_price} onChange={e => setForm(f=>({...f,cost_price:e.target.value}))} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">Precio venta</label>
                  <input className="input" type="number" value={form.sale_price} onChange={e => setForm(f=>({...f,sale_price:e.target.value}))} placeholder="0.00" />
                </div>
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
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Notas</label>
                  <input className="input" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Indicaciones, observaciones..." />
                </div>
              </div>
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
