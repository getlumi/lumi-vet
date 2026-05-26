import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function ChatVet({ clinic, session }) {
  const [chats, setChats]       = useState([])
  const [active, setActive]     = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText]         = useState('')
  const bottomRef               = useRef(null)

  useEffect(() => { fetchChats() }, [])
  useEffect(() => { if (active) fetchMessages(active.id) }, [active])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const fetchChats = async () => {
    const { data } = await supabase
      .from('vet_chats')
      .select('*, profiles(name, avatar_url)')
      .eq('clinic_id', clinic.id)
      .order('last_message_at', { ascending:false })
    setChats(data || [])
  }

  const fetchMessages = async (chatId) => {
    const { data } = await supabase
      .from('vet_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at')
    setMessages(data || [])

    // Suscripción real time
    supabase.channel(`vet-chat-${chatId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'vet_messages', filter:`chat_id=eq.${chatId}` },
        payload => setMessages(prev => [...prev, payload.new]))
      .subscribe()
  }

  const sendMessage = async () => {
    if (!text.trim() || !active) return
    const msg = text.trim(); setText('')
    const tempMsg = { id:`temp-${Date.now()}`, chat_id:active.id, sender_id:session.user.id, sender_type:'vet', text:msg, created_at:new Date().toISOString() }
    setMessages(prev => [...prev, tempMsg])
    await supabase.from('vet_messages').insert({ chat_id:active.id, sender_id:session.user.id, sender_type:'vet', text:msg })
    await supabase.from('vet_chats').update({ last_message:msg, last_message_at:new Date().toISOString() }).eq('id', active.id)
    fetchChats()
  }

  const formatTime = (iso) => {
    const d = new Date(iso)
    const diff = Math.floor((Date.now()-d)/1000)
    if (diff < 3600) return `${Math.floor(diff/60)}m`
    if (diff < 86400) return `${Math.floor(diff/3600)}h`
    return d.toLocaleDateString('es-MX',{day:'numeric',month:'short'})
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', height:'calc(100vh - 48px)', gap:0, background:'white', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
      {/* Lista de chats */}
      <div style={{ borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--border)', fontWeight:800, fontSize:16 }}>Mensajes de clientes</div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {chats.length === 0 ? (
            <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-muted)' }}>
              <i className="ti ti-message-circle" style={{ fontSize:32, display:'block', marginBottom:8 }} />
              <p style={{ fontSize:13 }}>Sin mensajes aún</p>
            </div>
          ) : chats.map(chat => (
            <div key={chat.id} onClick={() => setActive(chat)} style={{ padding:'12px 16px', cursor:'pointer', background: active?.id === chat.id ? 'var(--purple-light)' : 'transparent', borderBottom:'1px solid #F3F4F6', display:'flex', gap:10, alignItems:'center' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className="ti ti-user" style={{ color:'var(--purple)', fontSize:18 }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <p style={{ fontSize:13, fontWeight:700, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{chat.profiles?.name || 'Cliente'}</p>
                  <span style={{ fontSize:10, color:'var(--text-muted)' }}>{formatTime(chat.last_message_at)}</span>
                </div>
                <p style={{ fontSize:11, color:'var(--text-muted)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{chat.last_message || 'Nueva conversación'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat activo */}
      {active ? (
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-user" style={{ color:'var(--purple)', fontSize:16 }} />
            </div>
            <p style={{ fontSize:15, fontWeight:700, margin:0 }}>{active.profiles?.name || 'Cliente'}</p>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:8 }}>
            {messages.map(msg => {
              const isVet = msg.sender_type === 'vet'
              return (
                <div key={msg.id} style={{ display:'flex', justifyContent: isVet ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth:'70%', background: isVet ? 'var(--purple)' : '#F3F4F6', color: isVet ? 'white' : 'var(--text-primary)', borderRadius: isVet ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding:'10px 14px' }}>
                    <p style={{ fontSize:14, margin:'0 0 4px' }}>{msg.text}</p>
                    <p style={{ fontSize:10, margin:0, opacity:0.6, textAlign:'right' }}>{new Date(msg.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:10 }}>
            <input className="input" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && sendMessage()} placeholder="Escribe un mensaje..." style={{ flex:1 }} />
            <button className="btn btn-primary btn-icon" onClick={sendMessage} disabled={!text.trim()}>
              <i className="ti ti-send" />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--text-muted)' }}>
          <i className="ti ti-message-circle" style={{ fontSize:48 }} />
          <p style={{ fontSize:15, fontWeight:600 }}>Selecciona una conversación</p>
        </div>
      )}
    </div>
  )
}
