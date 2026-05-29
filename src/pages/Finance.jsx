import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PERIODS = [
  { id: 'day',       label: 'Hoy' },
  { id: 'week',      label: 'Esta semana' },
  { id: 'biweek',    label: 'Quincenal' },
  { id: 'month',     label: 'Este mes' },
]

const CATEGORY_LABELS = {
  servicio: 'Servicio', producto: 'Producto', consulta: 'Consulta',
  vacuna: 'Vacuna', baño: 'Baño', otro: 'Otro',
}
const CATEGORY_COLORS = {
  servicio: '#7C3AED', producto: '#0EA5E9', consulta: '#16A34A',
  vacuna: '#F59E0B', baño: '#EC4899', otro: '#6B7280',
}

function getDateRange(period) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (period === 'day') return { from: today, to: today, label: 'Hoy' }
  if (period === 'week') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(new Date().setDate(diff))
    return { from: monday.toISOString().slice(0, 10), to: today, label: 'Esta semana' }
  }
  if (period === 'biweek') {
    const day = now.getDate()
    const from = day <= 15
      ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      : new Date(now.getFullYear(), now.getMonth(), 16).toISOString().slice(0, 10)
    return { from, to: today, label: 'Quincenal' }
  }
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    return { from, to: today, label: 'Este mes' }
  }
  return { from: today, to: today, label: 'Hoy' }
}

export default function Finance({ clinic }) {
  const [period, setPeriod]             = useState('month')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [showAdd, setShowAdd]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [form, setForm] = useState({
    type:'income', category:'servicio', description:'', amount:'',
    date: new Date().toISOString().slice(0, 10)
  })

  useEffect(() => { fetchTransactions() }, [period])

  const fetchTransactions = async () => {
    setLoading(true)
    const { from, to } = getDateRange(period)
    const { data } = await supabase
      .from('vet_transactions')
      .select('*')
      .eq('clinic_id', clinic.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }

  const saveTransaction = async () => {
    if (!form.amount || !form.description) return
    setSaving(true)
    await supabase.from('vet_transactions').insert({
      clinic_id: clinic.id, type: 'income', category: form.category,
      description: form.description, amount: parseFloat(form.amount), date: form.date,
    })
    setSaving(false)
    setShowAdd(false)
    setForm({ type:'income', category:'servicio', description:'', amount:'', date: new Date().toISOString().slice(0, 10) })
    fetchTransactions()
  }

  const deleteTransaction = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('vet_transactions').delete().eq('id', id)
    fetchTransactions()
  }

  // Métricas
  const income   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0)
  const profit   = income - expenses

  const byCategory = transactions.filter(t => t.type === 'income').reduce((acc, t) => {
    const cat = t.category || 'otro'
    acc[cat] = (acc[cat] || 0) + (t.amount || 0)
    return acc
  }, {})

  const byDay = transactions.filter(t => t.type === 'income').reduce((acc, t) => {
    acc[t.date] = (acc[t.date] || 0) + (t.amount || 0)
    return acc
  }, {})
  const maxDayAmount = Math.max(...Object.values(byDay), 1)
  const sortedDays = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))

  const formatDate  = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short' })
  const formatMoney = (n) => n.toLocaleString('es-MX', { style:'currency', currency:'MXN', minimumFractionDigits:0 })

  // ── Exportar Excel ──
  const exportExcel = () => {
    const { label } = getDateRange(period)
    const rows = transactions.map(t => ({
      Fecha:       t.date,
      Descripción: t.description || '',
      Categoría:   CATEGORY_LABELS[t.category] || t.category || '',
      Monto:       t.amount,
    }))
    rows.push({})
    rows.push({ Fecha:'', Descripción:'TOTAL INGRESOS', Categoría:'', Monto: income })

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch:12 },{ wch:30 },{ wch:14 },{ wch:12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Finanzas')
    XLSX.writeFile(wb, `Lumi-Finanzas-${clinic.name}-${label}.xlsx`)
  }

  // ── Exportar PDF ──
  const exportPDF = () => {
    const { label, from, to } = getDateRange(period)
    const doc = new jsPDF()

    // Header
    doc.setFontSize(18)
    doc.setTextColor(107, 33, 168)
    doc.text('Lumi Vet — Reporte Financiero', 14, 20)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`${clinic.name} · ${clinic.city || ''}`, 14, 28)
    doc.text(`Período: ${label} (${from} al ${to})`, 14, 35)

    // Métricas
    doc.setFontSize(10)
    doc.setTextColor(40)
    doc.text(`Total ingresos: ${formatMoney(income)}   Registros: ${transactions.length}`, 14, 45)

    // Tabla
    autoTable(doc, {
      startY: 52,
      head: [['Fecha', 'Descripción', 'Categoría', 'Monto']],
      body: transactions.map(t => [
        t.date,
        t.description || '—',
        CATEGORY_LABELS[t.category] || t.category || '—',
        '+' + formatMoney(t.amount || 0),
      ]),
      headStyles: { fillColor: [107, 33, 168], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 243, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      foot: [['', '', 'TOTAL', formatMoney(income)]],
      footStyles: { fillColor: [237, 233, 254], textColor: [107, 33, 168], fontStyle: 'bold' },
    })

    doc.save(`Lumi-Finanzas-${clinic.name}-${label}.pdf`)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 4px' }}>Reportes</p>
          <p style={{ fontSize:24, fontWeight:700, color:'var(--purple-dark)', margin:0, letterSpacing:'-0.3px' }}>Finanzas</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={exportExcel} title="Exportar Excel">
            <i className="ti ti-file-spreadsheet" /> Excel
          </button>
          <button className="btn btn-secondary" onClick={exportPDF} title="Exportar PDF">
            <i className="ti ti-file-type-pdf" /> PDF
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <i className="ti ti-plus" /> Registrar
          </button>
        </div>
      </div>

      {/* Selector período */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {PERIODS.map(p => (
          <button key={p.id} className={`btn ${period===p.id?'btn-primary':'btn-secondary'} btn-sm`} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Métricas */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:20 }}>
        {[
          { label:'Ingresos',  value: formatMoney(income),        icon:'ti-trending-up', color:'#16A34A', bg:'#DCFCE7' },
          { label:'Promedio',  value: formatMoney(transactions.length ? income/transactions.length : 0), icon:'ti-chart-bar', color:'#7C3AED', bg:'#EDE9FE' },
          { label:'Registros', value: transactions.length,        icon:'ti-receipt',     color:'#0EA5E9', bg:'#E0F2FE' },
        ].map(m => (
          <div key={m.label} className="stat-card">
            <div className="stat-icon" style={{ background: m.bg }}>
              <i className={`ti ${m.icon}`} style={{ color: m.color, fontSize:20 }} />
            </div>
            <div>
              <p style={{ fontSize:11, color:'var(--text-muted)', margin:'0 0 2px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{m.label}</p>
              <p style={{ fontSize:18, fontWeight:800, color: m.color, margin:0 }}>{m.value}</p>
            </div>
          </div>
        ))}
      </div>

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
                  <div style={{ width:'100%', background:'var(--purple-light)', borderRadius:4, height: Math.max(8, (amount/maxDayAmount)*90), position:'relative', overflow:'hidden' }}>
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
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', textTransform:'capitalize' }}>
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                    <span style={{ fontSize:12, fontWeight:700, color: CATEGORY_COLORS[cat] || '#6B7280' }}>
                      {formatMoney(total)}
                    </span>
                  </div>
                  <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(total/income)*100}%`, background: CATEGORY_COLORS[cat] || '#6B7280', borderRadius:3, transition:'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
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
              <tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th><th>Monto</th><th></th></tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(t.date)}</td>
                  <td style={{ fontWeight:600 }}>{t.description || '—'}</td>
                  <td>
                    <span className="badge" style={{ background:(CATEGORY_COLORS[t.category]||'#6B7280')+'18', color: CATEGORY_COLORS[t.category]||'#6B7280', textTransform:'capitalize' }}>
                      {CATEGORY_LABELS[t.category] || t.category || '—'}
                    </span>
                  </td>

                  <td style={{ fontWeight:800, color:'#16A34A', whiteSpace:'nowrap' }}>
                    +{formatMoney(t.amount || 0)}
                  </td>
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

      {/* Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>Registrar movimiento</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input type="hidden" value="income" />
              <div className="grid-2">
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
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
