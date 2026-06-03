import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PERIODS = [
  { id: 'day',    label: 'Hoy' },
  { id: 'week',   label: 'Semana' },
  { id: 'biweek', label: 'Quincenal' },
  { id: 'month',  label: 'Mes' },
  { id: 'year',   label: 'Año' },
]

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CATEGORY_LABELS = { servicio:'Servicio', producto:'Producto', consulta:'Consulta', vacuna:'Vacuna', baño:'Baño', otro:'Otro' }
const CATEGORY_COLORS = { servicio:'#7C3AED', producto:'#0EA5E9', consulta:'#16A34A', vacuna:'#F59E0B', baño:'#EC4899', otro:'#6B7280' }

function getDateRange(period, selectedYear) {
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(now)
  if (period === 'day') return { from: today, to: today, label: 'Hoy' }
  if (period === 'week') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(new Date().setDate(diff))
    return { from: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(monday), to: today, label: 'Esta semana' }
  }
  if (period === 'biweek') {
    const d = now.getDate()
    const from = d <= 15
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(new Date(now.getFullYear(), now.getMonth(), 1))
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(new Date(now.getFullYear(), now.getMonth(), 16))
    return { from, to: today, label: 'Quincenal' }
  }
  if (period === 'month') {
    const from = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(new Date(now.getFullYear(), now.getMonth(), 1))
    return { from, to: today, label: 'Este mes' }
  }
  if (period === 'year') {
    const y = selectedYear || now.getFullYear()
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Año ${y}` }
  }
  return { from: today, to: today, label: 'Hoy' }
}

const localToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(new Date())

export default function AdminGlobal({ clinic }) {
  const [period, setPeriod]             = useState('month')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [transactions, setTransactions] = useState([])
  const [counts, setCounts]             = useState({ appointments:0, lumiPatients:0, regularPatients:0, inventory:0, services:0 })
  const [loading, setLoading]           = useState(true)
  const [showAdd, setShowAdd]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [form, setForm] = useState({ category:'servicio', description:'', amount:'', date: localToday() })

  useEffect(() => { fetchAll() }, [period, selectedYear])

  const fetchAll = async () => {
    setLoading(true)
    const { from, to } = getDateRange(period, selectedYear)

    const [txRes, apptRes, lumiRes, regRes, invRes, svcRes] = await Promise.all([
      supabase.from('vet_transactions').select('*').eq('clinic_id', clinic.id).gte('date', from).lte('date', to).order('date', { ascending: false }),
      supabase.from('vet_appointments').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
      supabase.from('vet_patients').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
      supabase.from('vet_regular_patients').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
      supabase.from('vet_inventory').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
      supabase.from('vet_services').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
    ])

    setTransactions(txRes.data || [])
    setCounts({
      appointments:   apptRes.count  || 0,
      lumiPatients:   lumiRes.count  || 0,
      regularPatients: regRes.count  || 0,
      inventory:      invRes.count   || 0,
      services:       svcRes.count   || 0,
    })
    setLoading(false)
  }

  const saveTransaction = async () => {
    if (!form.amount || !form.description) return
    setSaving(true)
    await supabase.from('vet_transactions').insert({
      clinic_id: clinic.id, type:'income', category: form.category,
      description: form.description, amount: parseFloat(form.amount), date: form.date,
    })
    setSaving(false); setShowAdd(false)
    setForm({ category:'servicio', description:'', amount:'', date: localToday() })
    fetchAll()
  }

  const deleteTransaction = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('vet_transactions').delete().eq('id', id)
    fetchAll()
  }

  // Métricas financieras
  const income    = transactions.filter(t => t.type === 'income').reduce((s,t) => s + (t.amount||0), 0)
  const incomeSvc = transactions.filter(t => t.type === 'income' && ['servicio','consulta','vacuna','baño'].includes(t.category)).reduce((s,t) => s + (t.amount||0), 0)
  const incomePrd = transactions.filter(t => t.type === 'income' && t.category === 'producto').reduce((s,t) => s + (t.amount||0), 0)

  const byCategory = transactions.filter(t => t.type === 'income').reduce((acc,t) => {
    const cat = t.category || 'otro'
    acc[cat] = (acc[cat] || 0) + (t.amount || 0)
    return acc
  }, {})

  const byDay = transactions.filter(t => t.type === 'income').reduce((acc,t) => {
    acc[t.date] = (acc[t.date] || 0) + (t.amount || 0)
    return acc
  }, {})
  const maxDayAmount = Math.max(...Object.values(byDay), 1)
  const sortedDays   = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b))

  // Vista anual — agrupar por mes
  const byMonth = Array(12).fill(0)
  if (period === 'year') {
    transactions.filter(t => t.type === 'income').forEach(t => {
      const m = new Date(t.date + 'T12:00:00').getMonth()
      byMonth[m] += (t.amount || 0)
    })
  }

  const formatMoney = (n) => n.toLocaleString('es-MX', { style:'currency', currency:'MXN', minimumFractionDigits:0 })
  const formatDate  = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short' })

  const years = [2024, 2025, 2026, 2027]

  const exportExcel = () => {
    const { label } = getDateRange(period, selectedYear)
    const rows = transactions.map(t => ({ Fecha: t.date, Descripcion: t.description||'', Categoria: CATEGORY_LABELS[t.category]||t.category||'', Monto: t.amount }))
    rows.push({})
    rows.push({ Fecha:'', Descripcion:'TOTAL INGRESOS', Categoria:'', Monto: income })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch:12 },{ wch:30 },{ wch:14 },{ wch:12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Admin Global')
    XLSX.writeFile(wb, `Lumi-Admin-${clinic.name}-${label}.xlsx`)
  }

  const exportPDF = () => {
    const { label, from, to } = getDateRange(period, selectedYear)
    const doc = new jsPDF()
    doc.setFontSize(18); doc.setTextColor(107,33,168)
    doc.text('Lumi Vet — Panel Admin', 14, 20)
    doc.setFontSize(11); doc.setTextColor(100)
    doc.text(`${clinic.name} · ${clinic.city||''}`, 14, 28)
    doc.text(`Período: ${label} (${from} al ${to})`, 14, 35)
    doc.setFontSize(10); doc.setTextColor(40)
    doc.text(`Ingresos: ${formatMoney(income)}   Servicios: ${formatMoney(incomeSvc)}   Productos: ${formatMoney(incomePrd)}`, 14, 45)
    autoTable(doc, {
      startY: 52,
      head: [['Fecha','Descripción','Categoría','Monto']],
      body: transactions.map(t => [t.date, t.description||'—', CATEGORY_LABELS[t.category]||t.category||'—', '+'+formatMoney(t.amount||0)]),
      headStyles: { fillColor:[107,33,168], textColor:255, fontStyle:'bold' },
      alternateRowStyles: { fillColor:[245,243,255] },
      styles: { fontSize:9, cellPadding:3 },
      foot: [['','','TOTAL',formatMoney(income)]],
      footStyles: { fillColor:[237,233,254], textColor:[107,33,168], fontStyle:'bold' },
    })
    doc.save(`Lumi-Admin-${clinic.name}-${label}.pdf`)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 4px' }}>Veterinaria</p>
          <p style={{ fontSize:24, fontWeight:700, color:'var(--purple-dark)', margin:0, letterSpacing:'-0.3px' }}>Panel Admin</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={exportExcel}><i className="ti ti-file-spreadsheet" /> Excel</button>
          <button className="btn btn-secondary" onClick={exportPDF}><i className="ti ti-file-type-pdf" /> PDF</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><i className="ti ti-plus" /> Registrar</button>
        </div>
      </div>

      {/* Selector período */}
      <div style={{ display:'flex', gap:8, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        {PERIODS.map(p => (
          <button key={p.id} className={`btn ${period===p.id?'btn-primary':'btn-secondary'} btn-sm`} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
        {period === 'year' && (
          <select className="input" style={{ width:'auto', padding:'6px 12px' }} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {/* KPIs — Operación */}
      <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', margin:'0 0 12px' }}>Resumen operativo</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Citas',         value: counts.appointments,    icon:'ti-calendar',          color:'#7C3AED', bg:'#EDE9FE' },
          { label:'Pacientes Lumi', value: counts.lumiPatients,    icon:'ti-paw',               color:'#DB2777', bg:'#FCE7F3' },
          { label:'Regulares',     value: counts.regularPatients, icon:'ti-user',              color:'#0EA5E9', bg:'#E0F2FE' },
          { label:'Productos',     value: counts.inventory,       icon:'ti-package',           color:'#16A34A', bg:'#DCFCE7' },
          { label:'Servicios',     value: counts.services,        icon:'ti-stethoscope',       color:'#F59E0B', bg:'#FEF3C7' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-icon" style={{ background:k.bg }}>
              <i className={`ti ${k.icon}`} style={{ color:k.color, fontSize:20 }} />
            </div>
            <div>
              <p style={{ fontSize:11, color:'var(--text-muted)', margin:'0 0 2px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{k.label}</p>
              <p style={{ fontSize:22, fontWeight:900, color:k.color, margin:0 }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* KPIs — Finanzas */}
      <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', margin:'0 0 12px' }}>
        Finanzas — {getDateRange(period, selectedYear).label}
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20 }}>
        {[
          { label:'Total ingresos',    value: formatMoney(income),    icon:'ti-trending-up',  color:'#16A34A', bg:'#DCFCE7' },
          { label:'Servicios',         value: formatMoney(incomeSvc), icon:'ti-stethoscope',  color:'#7C3AED', bg:'#EDE9FE' },
          { label:'Productos',         value: formatMoney(incomePrd), icon:'ti-package',      color:'#0EA5E9', bg:'#E0F2FE' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-icon" style={{ background:k.bg }}>
              <i className={`ti ${k.icon}`} style={{ color:k.color, fontSize:20 }} />
            </div>
            <div>
              <p style={{ fontSize:11, color:'var(--text-muted)', margin:'0 0 2px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{k.label}</p>
              <p style={{ fontSize:18, fontWeight:800, color:k.color, margin:0 }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Vista anual — tabla mes a mes */}
      {period === 'year' && (
        <div className="card" style={{ marginBottom:20 }}>
          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.6px', margin:'0 0 16px' }}>
            Desglose mensual — {selectedYear}
          </p>
          <table className="table">
            <thead>
              <tr><th>Mes</th><th>Ingresos</th><th>% del año</th></tr>
            </thead>
            <tbody>
              {MONTHS.map((mes, i) => (
                <tr key={mes} style={{ opacity: byMonth[i] === 0 ? 0.4 : 1 }}>
                  <td style={{ fontWeight:600 }}>{mes}</td>
                  <td style={{ fontWeight:700, color: byMonth[i] > 0 ? '#16A34A' : 'var(--text-muted)' }}>
                    {formatMoney(byMonth[i])}
                  </td>
                  <td>
                    {income > 0 ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${(byMonth[i]/income)*100}%`, background:'var(--gradient)', borderRadius:3 }} />
                        </div>
                        <span style={{ fontSize:11, color:'var(--text-muted)', minWidth:32 }}>
                          {income > 0 ? Math.round((byMonth[i]/income)*100) : 0}%
                        </span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight:800, color:'var(--purple)' }}>Total {selectedYear}</td>
                <td style={{ fontWeight:900, color:'#16A34A', fontSize:15 }}>{formatMoney(income)}</td>
                <td style={{ fontWeight:700, color:'var(--text-muted)' }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Gráficas */}
      {period !== 'year' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
          {/* Gráfica por día */}
          <div className="card">
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.6px', margin:'0 0 16px' }}>Ingresos por día</p>
            {sortedDays.length === 0 ? (
              <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Sin ingresos en este período</p>
            ) : (
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:120, overflowX:'auto' }}>
                {sortedDays.slice(-14).map(([date, amount]) => (
                  <div key={date} style={{ minWidth:28, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <p style={{ fontSize:8, color:'var(--purple)', fontWeight:700, margin:0, whiteSpace:'nowrap' }}>
                      ${amount >= 1000 ? (amount/1000).toFixed(1)+'k' : Math.round(amount)}
                    </p>
                    <div style={{ width:'100%', background:'var(--purple-light)', borderRadius:4, height:Math.max(8,(amount/maxDayAmount)*90), position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'var(--gradient)', height:'100%', borderRadius:4 }} />
                    </div>
                    <p style={{ fontSize:7, color:'var(--text-muted)', margin:0, whiteSpace:'nowrap' }}>{formatDate(date)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Por categoría */}
          <div className="card">
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.6px', margin:'0 0 16px' }}>Por categoría</p>
            {Object.keys(byCategory).length === 0 ? (
              <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Sin datos</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {Object.entries(byCategory).sort(([,a],[,b]) => b-a).map(([cat, total]) => (
                  <div key={cat}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', textTransform:'capitalize' }}>{CATEGORY_LABELS[cat]||cat}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:CATEGORY_COLORS[cat]||'#6B7280' }}>{formatMoney(total)}</span>
                    </div>
                    <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(total/income)*100}%`, background:CATEGORY_COLORS[cat]||'#6B7280', borderRadius:3, transition:'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabla transacciones */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.6px', margin:0 }}>Registros</p>
          <span className="badge badge-purple">{transactions.length} movimientos</span>
        </div>
        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>Cargando...</div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 20px' }}>
            <i className="ti ti-receipt" style={{ fontSize:36, color:'var(--text-muted)', display:'block', marginBottom:10 }} />
            <p style={{ fontSize:14, fontWeight:700, margin:'0 0 6px' }}>Sin registros en este período</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Agregar primero</button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th></th></tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(t.date)}</td>
                  <td style={{ fontWeight:600 }}>{t.description||'—'}</td>
                  <td>
                    <span className="badge" style={{ background:(CATEGORY_COLORS[t.category]||'#6B7280')+'18', color:CATEGORY_COLORS[t.category]||'#6B7280', textTransform:'capitalize' }}>
                      {CATEGORY_LABELS[t.category]||t.category||'—'}
                    </span>
                  </td>
                  <td style={{ fontWeight:800, color:'#16A34A', whiteSpace:'nowrap' }}>+{formatMoney(t.amount||0)}</td>
                  <td>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteTransaction(t.id)}>
                      <i className="ti ti-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal registrar */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>Registrar ingreso</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="grid-2">
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {Object.entries(CATEGORY_LABELS).map(([val,label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Descripción *</label>
                <input className="input" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Baño Golden, Consulta Dante..." />
              </div>
              <div>
                <label className="label">Monto *</label>
                <input className="input" type="number" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} placeholder="350.00" />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveTransaction} disabled={!form.amount||!form.description||saving} style={{ flex:2, justifyContent:'center' }}>
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
