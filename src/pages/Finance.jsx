import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const INCOME_CATS  = ['consulta','cirugía','vacuna','grooming','venta','otro']
const EXPENSE_CATS = ['renta','sueldos','insumos','servicios','mantenimiento','otro']

export default function Finance({ clinic }) {
  const [transactions, setTransactions] = useState([])
  const [period, setPeriod]   = useState(new Date().toISOString().slice(0,7))
  const [showModal, setShowModal] = useState(false)
  const [type, setType]       = useState('income')
  const [form, setForm]       = useState({ description:'', amount:'', category:'consulta', date: new Date().toISOString().slice(0,10) })

  useEffect(() => { fetchTransactions() }, [period])

  const fetchTransactions = async () => {
    const start = period + '-01'
    const end   = new Date(period + '-01')
    end.setMonth(end.getMonth() + 1)
    const endStr = end.toISOString().slice(0,10)

    const { data } = await supabase
      .from('vet_transactions')
      .select('*')
      .eq('clinic_id', clinic.id)
      .gte('date', start)
      .lt('date', endStr)
      .order('date', { ascending:false })
    setTransactions(data || [])
  }

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s,t) => s + parseFloat(t.amount||0), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + parseFloat(t.amount||0), 0)
  const balance      = totalIncome - totalExpense

  const saveTransaction = async () => {
    await supabase.from('vet_transactions').insert({ ...form, type, clinic_id: clinic.id, amount: parseFloat(form.amount) })
    fetchTransactions(); setShowModal(false); setForm({ description:'', amount:'', category:'consulta', date: new Date().toISOString().slice(0,10) })
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <p style={{ fontSize:20, fontWeight:800, margin:0 }}>Finanzas</p>
        <div style={{ display:'flex', gap:8 }}>
          <input type="month" className="input" style={{ width:'auto' }} value={period} onChange={e => setPeriod(e.target.value)} />
          <button className="btn btn-primary" onClick={() => { setType('income'); setShowModal(true) }}><i className="ti ti-plus" /> Ingreso</button>
          <button className="btn btn-danger" onClick={() => { setType('expense'); setShowModal(true) }}><i className="ti ti-minus" /> Egreso</button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid-3" style={{ marginBottom:20 }}>
        {[
          { label:'Ingresos', value:totalIncome, color:'#DCFCE7', icon:'ti-trending-up', iconColor:'#16A34A' },
          { label:'Egresos',  value:totalExpense, color:'#FEE2E2', icon:'ti-trending-down', iconColor:'#DC2626' },
          { label:'Balance',  value:balance, color: balance >= 0 ? '#EDE9FE' : '#FEE2E2', icon:'ti-coin', iconColor: balance >= 0 ? '#6B21A8' : '#DC2626' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background:s.color }}>
              <i className={`ti ${s.icon}`} style={{ color:s.iconColor }} />
            </div>
            <div>
              <p style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', margin:'0 0 2px' }}>{s.label}</p>
              <p style={{ fontSize:22, fontWeight:900, margin:0, color: s.label === 'Balance' ? (balance>=0?'#16A34A':'#DC2626') : 'var(--text-primary)' }}>
                ${s.value.toLocaleString('es-MX', {minimumFractionDigits:2})}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="card">
        {transactions.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)' }}>
            <i className="ti ti-receipt" style={{ fontSize:40, display:'block', marginBottom:12 }} />
            <p>Sin movimientos en este período</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th><th style={{ textAlign:'right' }}>Monto</th></tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td style={{ color:'var(--text-secondary)', fontSize:13 }}>{new Date(t.date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</td>
                  <td style={{ fontWeight:600 }}>{t.description}</td>
                  <td><span className="badge badge-gray" style={{ textTransform:'capitalize' }}>{t.category}</span></td>
                  <td><span className={`badge ${t.type === 'income' ? 'badge-green' : 'badge-red'}`}>{t.type === 'income' ? 'Ingreso' : 'Egreso'}</span></td>
                  <td style={{ textAlign:'right', fontWeight:700, color: t.type === 'income' ? '#16A34A' : '#DC2626' }}>
                    {t.type === 'income' ? '+' : '-'}${parseFloat(t.amount).toLocaleString('es-MX',{minimumFractionDigits:2})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>Registrar {type === 'income' ? 'ingreso' : 'egreso'}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label className="label">Descripción *</label>
                <input className="input" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Consulta general..." />
              </div>
              <div className="grid-2">
                <div>
                  <label className="label">Monto *</label>
                  <input className="input" type="number" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Categoría</label>
                <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                  {(type === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c} style={{ textTransform:'capitalize' }}>{c}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveTransaction} disabled={!form.description || !form.amount} style={{ flex:2, justifyContent:'center' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
