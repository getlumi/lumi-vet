import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function SupportVet({ clinic }) {
  const [messages, setMessages] = useState([])
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const bottomRef               = useRef(null)

  useEffect(() => {
    fetchMessages()

    // Realtime
    const channel = supabase
      .channel(`support_${clinic.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'vet_support_messages',
        filter: `clinic_id=eq.${clinic.id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new])
        markRead()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [clinic.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('vet_support_messages')
      .select('*')
      .eq('clinic_id', clinic.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
    markRead()
  }

  const markRead = async () => {
    await supabase
      .from('vet_support_messages')
      .update({ read: true })
      .eq('clinic_id', clinic.id)
      .eq('sender', 'admin')
      .eq('read', false)
  }

  const send = async () => {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    setText('')
    await supabase.from('vet_support_messages').insert({
      clinic_id: clinic.id,
      sender:    'clinic',
      message:   msg,
      read:      false,
    })
    setSending(false)
  }

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })

  const formatDate = (ts) => {
    const d = new Date(ts)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) return 'Hoy'
    return d.toLocaleDateString('es-MX', { day:'numeric', month:'long' })
  }

  // Agrupar por día
  const grouped = messages.reduce((acc, m) => {
    const day = new Date(m.created_at).toDateString()
    if (!acc[day]) acc[day] = []
    acc[day].push(m)
    return acc
  }, {})

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 80px)', maxWidth:640, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ padding:'20px 0 16px', borderBottom:'1px solid var(--border)', marginBottom:0 }}>
        <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 4px' }}>Lumi Vet</p>
        <p style={{ fontSize:24, fontWeight:700, color:'var(--purple-dark)', margin:'0 0 4px', letterSpacing:'-0.3px' }}>Soporte Lumi</p>
        <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>Escríbenos, respondemos a la brevedad.</p>
      </div>

      {/* Info */}
      <div style={{ padding:'12px 16px', background:'#F5F3FF', borderRadius:12, margin:'16px 0 0', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#6B21A8,#C026D3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <i className="ti ti-paw" style={{ fontSize:18, color:'white' }} />
        </div>
        <div>
          <p style={{ fontSize:13, fontWeight:700, color:'var(--purple)', margin:'0 0 2px' }}>Equipo Lumi</p>
          <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>
            Cambios de plan, soporte técnico y dudas generales
          </p>
        </div>
        <a href="https://instagram.com/lumilife2" target="_blank" rel="noreferrer"
          style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'6px 12px', textDecoration:'none', flexShrink:0 }}>
          <i className="ti ti-brand-instagram" style={{ fontSize:16, color:'#C026D3' }} />
          <span style={{ fontSize:12, fontWeight:700, color:'#C026D3' }}>@lumilife2</span>
        </a>
      </div>

      {/* Mensajes */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 0', display:'flex', flexDirection:'column', gap:0 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>Cargando...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <i className="ti ti-message-circle" style={{ fontSize:26, color:'var(--purple)' }} />
            </div>
            <p style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:'0 0 8px' }}>Sin mensajes aún</p>
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0, lineHeight:1.5 }}>
              Escríbenos para solicitar un cambio de plan,<br />reportar un problema o hacer cualquier consulta.
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([day, msgs]) => (
            <div key={day}>
              {/* Separador de día */}
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 0' }}>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, whiteSpace:'nowrap' }}>
                  {formatDate(msgs[0].created_at)}
                </span>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
              </div>
              {msgs.map(m => {
                const isClinic = m.sender === 'clinic'
                return (
                  <div key={m.id} style={{ display:'flex', justifyContent: isClinic ? 'flex-end' : 'flex-start', marginBottom:8 }}>
                    {!isClinic && (
                      <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#6B21A8,#C026D3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginRight:8, alignSelf:'flex-end' }}>
                        <i className="ti ti-paw" style={{ fontSize:14, color:'white' }} />
                      </div>
                    )}
                    <div style={{ maxWidth:'72%' }}>
                      <div style={{
                        padding:'10px 14px',
                        borderRadius: isClinic ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isClinic ? 'var(--purple)' : 'white',
                        border: isClinic ? 'none' : '1px solid var(--border)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      }}>
                        <p style={{ fontSize:13, color: isClinic ? 'white' : 'var(--text-primary)', margin:0, lineHeight:1.5, wordBreak:'break-word' }}>
                          {m.message}
                        </p>
                      </div>
                      <p style={{ fontSize:10, color:'var(--text-muted)', margin:'3px 4px 0', textAlign: isClinic ? 'right' : 'left' }}>
                        {formatTime(m.created_at)}
                        {isClinic && m.read && <span style={{ marginLeft:4 }}>· Leído</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:'12px 0 8px', borderTop:'1px solid var(--border)' }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Escribe tu mensaje..."
            rows={2}
            style={{
              flex:1, padding:'12px 14px', borderRadius:14, border:'1.5px solid var(--border)',
              fontSize:13, fontFamily:'inherit', resize:'none', outline:'none', lineHeight:1.5,
              background:'var(--bg)',
            }}
          />
          <button onClick={send} disabled={!text.trim() || sending}
            style={{
              width:44, height:44, borderRadius:12, border:'none', flexShrink:0,
              background: text.trim() ? 'var(--purple)' : 'var(--border)',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              transition:'background 0.2s',
            }}>
            <i className="ti ti-send" style={{ fontSize:18, color:'white' }} />
          </button>
        </div>
        <p style={{ fontSize:11, color:'var(--text-muted)', margin:'6px 0 0', textAlign:'center' }}>
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  )
}
