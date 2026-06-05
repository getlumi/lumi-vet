import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function SupportVet({ clinic }) {
  const [messages, setMessages] = useState([])
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const bottomRef               = useRef(null)
  const textareaRef             = useRef(null)

  useEffect(() => {
    fetchMessages()
    const channel = supabase
      .channel(`support_vet_${clinic.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'vet_support_messages',
        filter: `clinic_id=eq.${clinic.id}`,
      }, payload => {
        setMessages(prev => {
          // Evitar duplicados
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        if (payload.new.sender === 'admin') markAdminRead()
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
    markAdminRead()
  }

  const markAdminRead = async () => {
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
    textareaRef.current?.focus()

    // Optimistic update — mostrar inmediatamente
    const tempMsg = {
      id: `temp_${Date.now()}`,
      clinic_id: clinic.id,
      sender: 'clinic',
      message: msg,
      read: false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    const { data, error } = await supabase
      .from('vet_support_messages')
      .insert({ clinic_id: clinic.id, sender: 'clinic', message: msg, read: false })
      .select()
      .single()

    if (!error && data) {
      // Reemplazar temp con el real
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
    }
    setSending(false)
  }

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })

  const formatDate = (ts) => {
    const d = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Hoy'
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
    return d.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })
  }

  // Agrupar por día
  const grouped = messages.reduce((acc, m) => {
    const day = new Date(m.created_at).toDateString()
    if (!acc[day]) acc[day] = []
    acc[day].push(m)
    return acc
  }, {})

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 48px)' }}>

      {/* Header */}
      <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', background:'white', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 4px' }}>Lumi Vet</p>
            <p style={{ fontSize:22, fontWeight:800, color:'var(--purple-dark)', margin:0, letterSpacing:'-0.3px' }}>Soporte Lumi</p>
          </div>
          <a href="https://instagram.com/lumilife2" target="_blank" rel="noreferrer"
            style={{ display:'flex', alignItems:'center', gap:8, background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', borderRadius:12, padding:'8px 14px', textDecoration:'none' }}>
            <i className="ti ti-brand-instagram" style={{ fontSize:16, color:'white' }} />
            <span style={{ fontSize:12, fontWeight:800, color:'white' }}>@lumilife2</span>
          </a>
        </div>
        <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'6px 0 0' }}>
          Escríbenos para cambios de plan, soporte técnico o cualquier duda.
        </p>
      </div>

      {/* Área de mensajes */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', background:'#F8F7FF' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16 }}>
            <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,#6B21A8,#C026D3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-message-circle" style={{ fontSize:30, color:'white' }} />
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', margin:'0 0 8px' }}>Sin mensajes aún</p>
              <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0, lineHeight:1.6, maxWidth:320 }}>
                Escríbenos para solicitar un cambio de plan, reportar un problema o hacer cualquier consulta.
              </p>
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([day, msgs]) => (
            <div key={day}>
              {/* Separador de día */}
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'20px 0 16px' }}>
                <div style={{ flex:1, height:1, background:'rgba(107,33,168,0.15)' }} />
                <span style={{ fontSize:11, color:'var(--purple)', fontWeight:700, background:'#EDE9FE', borderRadius:20, padding:'3px 12px', whiteSpace:'nowrap' }}>
                  {formatDate(msgs[0].created_at)}
                </span>
                <div style={{ flex:1, height:1, background:'rgba(107,33,168,0.15)' }} />
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {msgs.map(m => {
                  const isClinic = m.sender === 'clinic'
                  const isTemp   = m.id?.startsWith('temp_')
                  return (
                    <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: isClinic ? 'flex-end' : 'flex-start' }}>
                      {/* Etiqueta sender */}
                      <p style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', margin:'0 0 4px', paddingLeft: isClinic ? 0 : 4, paddingRight: isClinic ? 4 : 0 }}>
                        {isClinic ? clinic.name : '🐾 Equipo Lumi'}
                      </p>
                      <div style={{
                        maxWidth:'72%',
                        padding:'12px 16px',
                        borderRadius: isClinic ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isClinic ? 'linear-gradient(135deg,#6B21A8,#8B5CF6)' : 'white',
                        border: isClinic ? 'none' : '1px solid #E5E7EB',
                        boxShadow: isClinic ? '0 2px 12px rgba(107,33,168,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
                        opacity: isTemp ? 0.7 : 1,
                      }}>
                        <p style={{ fontSize:14, color: isClinic ? 'white' : '#111827', margin:0, lineHeight:1.55, wordBreak:'break-word' }}>
                          {m.message}
                        </p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3, paddingLeft: isClinic ? 0 : 4, paddingRight: isClinic ? 4 : 0 }}>
                        <p style={{ fontSize:10, color:'var(--text-muted)', margin:0 }}>
                          {formatTime(m.created_at)}
                        </p>
                        {isClinic && (
                          <p style={{ fontSize:10, color:'var(--text-muted)', margin:0 }}>
                            · {isTemp ? 'Enviando...' : m.read ? 'Leído' : 'Enviado'}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', background:'white', flexShrink:0 }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', background:'#F8F7FF', borderRadius:16, border:'1.5px solid #D8C8F8', padding:'10px 12px' }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Escribe tu mensaje..."
            rows={2}
            style={{
              flex:1, border:'none', background:'transparent',
              fontSize:14, fontFamily:'inherit', resize:'none', outline:'none',
              lineHeight:1.5, color:'var(--text-primary)',
            }}
          />
          <button onClick={send} disabled={!text.trim() || sending}
            style={{
              width:40, height:40, borderRadius:12, border:'none', flexShrink:0,
              background: text.trim() ? 'linear-gradient(135deg,#6B21A8,#8B5CF6)' : '#E5E7EB',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              transition:'all 0.2s', boxShadow: text.trim() ? '0 2px 8px rgba(107,33,168,0.3)' : 'none',
            }}>
            <i className="ti ti-send" style={{ fontSize:17, color:'white' }} />
          </button>
        </div>
        <p style={{ fontSize:11, color:'var(--text-muted)', margin:'6px 0 0', textAlign:'center' }}>
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  )
}
