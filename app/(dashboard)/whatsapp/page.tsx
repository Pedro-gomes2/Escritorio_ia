'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, ChevronRight, ChevronLeft, MessageSquare, Phone,
  RefreshCw, MessageCircle, Clock, Wifi, WifiOff, QrCode, Send,
  Zap, Bell, Tag, X, Check, Pencil
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Coluna = 'novo' | 'atendendo' | 'aguardando' | 'finalizado'

const TAGS_DISPONIVEIS = [
  { id: 'urgente', label: 'Urgente', cor: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'lead', label: 'Lead', cor: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'trabalhista', label: 'Trabalhista', cor: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'familia', label: 'Família', cor: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'imovel', label: 'Imóvel', cor: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: 'criminal', label: 'Criminal', cor: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'empresarial', label: 'Empresarial', cor: 'bg-teal-100 text-teal-700 border-teal-200' },
]

function tagInfo(id: string) {
  return TAGS_DISPONIVEIS.find(t => t.id === id) ?? { id, label: id, cor: 'bg-slate-100 text-slate-700 border-slate-200' }
}

interface Mensagem {
  texto: string
  timestamp: string
  de: string
}

interface Atendimento {
  id: string
  nome: string
  telefone: string | null
  assunto: string | null
  coluna: Coluna
  created_at: string
  mensagens: Mensagem[]
  ultima_mensagem: string | null
  ultimo_contato: string | null
  whatsapp_jid: string | null
  tags: string[]
  lembrete: string | null
  responsavel: string | null
}

interface RespostaRapida {
  id: string
  titulo: string
  mensagem: string
}

const COLUNAS: { id: Coluna; label: string; cor: string; bg: string; badge: string }[] = [
  { id: 'novo', label: '🟡 Novo Contato', cor: 'border-yellow-400', bg: 'bg-yellow-50', badge: 'bg-yellow-200 text-yellow-800' },
  { id: 'atendendo', label: '🔵 Em Atendimento', cor: 'border-blue-400', bg: 'bg-blue-50', badge: 'bg-blue-200 text-blue-800' },
  { id: 'aguardando', label: '🟠 Aguardando Cliente', cor: 'border-orange-400', bg: 'bg-orange-50', badge: 'bg-orange-200 text-orange-800' },
  { id: 'finalizado', label: '🟢 Finalizado', cor: 'border-green-400', bg: 'bg-green-50', badge: 'bg-green-200 text-green-800' },
]

const ORDEM: Coluna[] = ['novo', 'atendendo', 'aguardando', 'finalizado']

function telefoneLink(tel: string) {
  const num = tel.replace(/\D/g, '')
  return `https://wa.me/${num.startsWith('55') ? num : '55' + num}`
}

function horaRelativa(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR')
}

function cardBorderColor(card: Atendimento): string {
  if (card.coluna === 'finalizado') return 'border-slate-200'
  const ref = card.ultimo_contato || card.created_at
  const horas = (Date.now() - new Date(ref).getTime()) / 3600000
  if (horas > 24) return 'border-red-400'
  if (horas > 1) return 'border-yellow-400'
  return 'border-slate-200'
}

interface EvoStatus {
  qrcode?: { base64?: string }
  instance?: { state?: string }
  base64?: string
  state?: string
}

export default function WhatsappPage() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [historico, setHistorico] = useState<Atendimento | null>(null)
  const [form, setForm] = useState({ nome: '', telefone: '', assunto: '' })
  const [salvando, setSalvando] = useState(false)
  const [evoStatus, setEvoStatus] = useState<EvoStatus | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [loadingQR, setLoadingQR] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Respostas Rápidas
  const [respostas, setRespostas] = useState<RespostaRapida[]>([])
  const [showRespostas, setShowRespostas] = useState(false)
  const [modalRespostas, setModalRespostas] = useState(false)
  const [formResposta, setFormResposta] = useState({ titulo: '', mensagem: '' })
  const [editandoResposta, setEditandoResposta] = useState<string | null>(null)

  // Tags
  const [showTagsCard, setShowTagsCard] = useState<string | null>(null)

  // Lembrete
  const [lembreteInput, setLembreteInput] = useState('')
  const [salvandoLembrete, setSalvandoLembrete] = useState(false)

  const supabase = createClient()
  const mensagensRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (mensagensRef.current) {
      mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight
    }
  }, [historico?.mensagens])

  async function buscarStatusEvo() {
    setLoadingQR(true)
    try {
      const res = await fetch('/api/whatsapp/setup')
      const data = await res.json()
      setEvoStatus(data)
      setShowQR(true)
    } catch {
      // silently fail
    } finally {
      setLoadingQR(false)
    }
  }

  const evoConectado = evoStatus?.instance?.state === 'open' || evoStatus?.state === 'open'
  const qrBase64 = evoStatus?.qrcode?.base64 || evoStatus?.base64

  const [erroEnvio, setErroEnvio] = useState<string | null>(null)

  async function enviarResposta() {
    if (!historico?.whatsapp_jid || !resposta.trim()) return
    setEnviando(true)
    setErroEnvio(null)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jid: historico.whatsapp_jid,
          mensagem: resposta.trim(),
          atendimentoId: historico.id,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const novaMensagem = { texto: resposta.trim(), timestamp: new Date().toISOString(), de: 'Você' }
        setHistorico(h => h ? { ...h, mensagens: [...(h.mensagens || []), novaMensagem] } : h)
        setAtendimentos(prev => prev.map(a => a.id === historico.id
          ? { ...a, mensagens: [...(a.mensagens || []), novaMensagem], ultima_mensagem: resposta.trim() }
          : a
        ))
        setResposta('')
        setShowRespostas(false)
      } else {
        setErroEnvio(data?.error || `Erro ${res.status}`)
      }
    } catch (e) {
      setErroEnvio('Erro de conexão com o servidor')
    } finally {
      setEnviando(false)
    }
  }

  async function carregar() {
    const { data } = await supabase
      .from('atendimentos_whatsapp')
      .select('*')
      .order('ultimo_contato', { ascending: false, nullsFirst: false })
    const lista = (data as Atendimento[]) ?? []
    setAtendimentos(lista)
    // Atualiza o painel lateral se estiver aberto
    if (historico) {
      const atualizado = lista.find(a => a.id === historico.id)
      if (atualizado) setHistorico(atualizado)
    }
    setLoading(false)
  }

  async function carregarRespostas() {
    const { data } = await supabase.from('respostas_rapidas').select('*').order('created_at')
    setRespostas((data as RespostaRapida[]) ?? [])
  }

  useEffect(() => {
    carregar()
    carregarRespostas()
    const channel = supabase
      .channel('whatsapp_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos_whatsapp' }, () => {
        carregar()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    await supabase.from('atendimentos_whatsapp').insert({
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      assunto: form.assunto.trim() || null,
      coluna: 'novo',
      mensagens: [],
      tags: [],
    })
    setForm({ nome: '', telefone: '', assunto: '' })
    setModal(false)
    setSalvando(false)
    carregar()
  }

  async function mover(id: string, coluna: Coluna, direcao: 'avancar' | 'voltar') {
    const idx = ORDEM.indexOf(coluna)
    const novaColuna = direcao === 'avancar' ? ORDEM[idx + 1] : ORDEM[idx - 1]
    if (!novaColuna) return
    await supabase.from('atendimentos_whatsapp').update({ coluna: novaColuna }).eq('id', id)
    setAtendimentos(prev => prev.map(a => a.id === id ? { ...a, coluna: novaColuna } : a))
    if (historico?.id === id) setHistorico(h => h ? { ...h, coluna: novaColuna } : h)
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir atendimento de "${nome}"?`)) return
    await supabase.from('atendimentos_whatsapp').delete().eq('id', id)
    setAtendimentos(prev => prev.filter(a => a.id !== id))
    if (historico?.id === id) setHistorico(null)
  }

  async function toggleTag(atendimentoId: string, tag: string, tagsAtuais: string[]) {
    const novasTags = tagsAtuais.includes(tag)
      ? tagsAtuais.filter(t => t !== tag)
      : [...tagsAtuais, tag]
    await supabase.from('atendimentos_whatsapp').update({ tags: novasTags }).eq('id', atendimentoId)
    setAtendimentos(prev => prev.map(a => a.id === atendimentoId ? { ...a, tags: novasTags } : a))
    if (historico?.id === atendimentoId) setHistorico(h => h ? { ...h, tags: novasTags } : h)
  }

  async function salvarLembrete() {
    if (!historico) return
    setSalvandoLembrete(true)
    const val = lembreteInput ? new Date(lembreteInput).toISOString() : null
    await supabase.from('atendimentos_whatsapp').update({ lembrete: val }).eq('id', historico.id)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, lembrete: val } : a))
    setHistorico(h => h ? { ...h, lembrete: val } : h)
    setSalvandoLembrete(false)
  }

  // Respostas Rápidas CRUD
  async function salvarResposta() {
    if (!formResposta.titulo.trim() || !formResposta.mensagem.trim()) return
    if (editandoResposta) {
      await supabase.from('respostas_rapidas').update({
        titulo: formResposta.titulo.trim(),
        mensagem: formResposta.mensagem.trim(),
      }).eq('id', editandoResposta)
    } else {
      await supabase.from('respostas_rapidas').insert({
        titulo: formResposta.titulo.trim(),
        mensagem: formResposta.mensagem.trim(),
      })
    }
    setFormResposta({ titulo: '', mensagem: '' })
    setEditandoResposta(null)
    carregarRespostas()
  }

  async function excluirResposta(id: string) {
    if (!confirm('Excluir resposta rápida?')) return
    await supabase.from('respostas_rapidas').delete().eq('id', id)
    carregarRespostas()
  }

  const lembreteVencidos = atendimentos.filter(a => {
    if (!a.lembrete || a.coluna === 'finalizado') return false
    return new Date(a.lembrete) <= new Date()
  })

  const novosCount = atendimentos.filter(a => a.coluna === 'novo').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">Gestão WhatsApp</h1>
              {novosCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {novosCount} novo{novosCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm">+55 21 96435-3290 · Evolution API</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalRespostas(true)}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            Respostas Rápidas
          </button>
          <button onClick={buscarStatusEvo} disabled={loadingQR}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
            <QrCode className="w-3.5 h-3.5" />
            {loadingQR ? 'Aguarde...' : 'Conectar WA'}
          </button>
          <button onClick={carregar}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Novo
          </button>
        </div>
      </div>

      {/* Banner de lembretes vencidos */}
      {lembreteVencidos.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Bell className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">
              {lembreteVencidos.length} lembrete{lembreteVencidos.length > 1 ? 's' : ''} vencido{lembreteVencidos.length > 1 ? 's' : ''}
            </p>
            <div className="space-y-0.5">
              {lembreteVencidos.map(a => (
                <p key={a.id} className="text-xs text-amber-700">
                  <button className="font-medium hover:underline" onClick={() => setHistorico(a)}>{a.nome}</button>
                  {' '}— {a.lembrete ? new Date(a.lembrete).toLocaleString('pt-BR') : ''}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QR Code panel */}
      {showQR && (
        <div className="mb-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {evoConectado
                ? <><Wifi className="w-4 h-4 text-green-500" /><span className="font-semibold text-green-700 text-sm">WhatsApp conectado!</span></>
                : <><WifiOff className="w-4 h-4 text-amber-500" /><span className="font-semibold text-amber-700 text-sm">Escaneie o QR Code com o WhatsApp</span></>
              }
            </div>
            <button onClick={() => setShowQR(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕ Fechar</button>
          </div>
          {evoConectado ? (
            <div className="bg-green-50 rounded-lg p-4 text-sm text-green-700">
              ✅ Número <strong>+55 21 96435-3290</strong> conectado. Mensagens recebidas aparecerão automaticamente no kanban.
            </div>
          ) : qrBase64 ? (
            <div className="flex items-start gap-6">
              <img src={qrBase64} alt="QR Code WhatsApp" className="w-48 h-48 border border-slate-200 rounded-lg" />
              <div className="text-sm text-slate-600 space-y-2 mt-2">
                <p className="font-medium text-slate-800">Como conectar:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-500">
                  <li>Abra o WhatsApp no celular <strong>(+5521964353290)</strong></li>
                  <li>Vá em <strong>Configurações → Aparelhos Conectados</strong></li>
                  <li>Toque em <strong>"Conectar um aparelho"</strong></li>
                  <li>Escaneie este QR Code</li>
                </ol>
                <button onClick={buscarStatusEvo} className="text-xs text-blue-600 hover:underline mt-2">↺ Atualizar QR Code</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Carregando QR Code...</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="flex gap-4">
          {/* Kanban board */}
          <div className="grid grid-cols-4 gap-3 flex-1 min-w-0">
            {COLUNAS.map(col => {
              const cards = atendimentos.filter(a => a.coluna === col.id)
              const idx = ORDEM.indexOf(col.id)
              return (
                <div key={col.id} className={`rounded-xl border-2 ${col.cor} ${col.bg} p-3`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-700">{col.label}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>
                      {cards.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {cards.map(card => {
                      const borderColor = cardBorderColor(card)
                      const temLembrete = card.lembrete && new Date(card.lembrete) > new Date()
                      const lembreteVencido = card.lembrete && new Date(card.lembrete) <= new Date()
                      return (
                        <div
                          key={card.id}
                          className={`bg-white rounded-lg border-2 shadow-sm p-3 cursor-pointer transition-all ${historico?.id === card.id ? 'border-blue-400 ring-2 ring-blue-200' : borderColor + ' hover:border-slate-300'}`}
                          onClick={() => {
                            setHistorico(historico?.id === card.id ? null : card)
                            setLembreteInput(card.lembrete ? new Date(card.lembrete).toISOString().slice(0, 16) : '')
                          }}
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              {(temLembrete || lembreteVencido) && (
                                <Bell className={`w-3 h-3 flex-shrink-0 ${lembreteVencido ? 'text-red-500' : 'text-amber-500'}`} />
                              )}
                              <p className="font-medium text-slate-800 text-xs leading-tight truncate">{card.nome}</p>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); excluir(card.id, card.nome) }}
                              className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {card.telefone && (
                            <a
                              href={telefoneLink(card.telefone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-green-600 hover:underline mb-1"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              {card.telefone}
                            </a>
                          )}

                          {card.ultima_mensagem && (
                            <p className="text-xs text-slate-500 line-clamp-1 mb-1">{card.ultima_mensagem}</p>
                          )}

                          {/* Tags */}
                          {card.tags && card.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {card.tags.map(tag => {
                                const t = tagInfo(tag)
                                return (
                                  <span key={tag} className={`text-xs px-1.5 py-0.5 rounded border font-medium ${t.cor}`}>
                                    {t.label}
                                  </span>
                                )
                              })}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            {card.mensagens?.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <MessageCircle className="w-2.5 h-2.5" />
                                {card.mensagens.length}
                              </span>
                            )}
                            {card.ultimo_contato && (
                              <span className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
                                <Clock className="w-2.5 h-2.5" />
                                {horaRelativa(card.ultimo_contato)}
                              </span>
                            )}
                          </div>

                          <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100">
                            {/* Botão de tag */}
                            <div className="relative">
                              <button
                                onClick={e => { e.stopPropagation(); setShowTagsCard(showTagsCard === card.id ? null : card.id) }}
                                className="text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-1 rounded transition-colors"
                              >
                                <Tag className="w-3 h-3" />
                              </button>
                              {showTagsCard === card.id && (
                                <div
                                  className="absolute left-0 top-7 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 w-36"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {TAGS_DISPONIVEIS.map(t => (
                                    <button
                                      key={t.id}
                                      onClick={() => toggleTag(card.id, t.id, card.tags || [])}
                                      className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-1.5 mb-0.5 ${card.tags?.includes(t.id) ? t.cor : 'hover:bg-slate-50 text-slate-600'}`}
                                    >
                                      {card.tags?.includes(t.id) && <Check className="w-3 h-3" />}
                                      {t.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {idx > 0 && (
                              <button
                                onClick={e => { e.stopPropagation(); mover(card.id, card.coluna, 'voltar') }}
                                className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-1 rounded transition-colors"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                            )}
                            {idx < ORDEM.length - 1 && (
                              <button
                                onClick={e => { e.stopPropagation(); mover(card.id, card.coluna, 'avancar') }}
                                className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-1 rounded transition-colors ml-auto"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {cards.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">Vazio</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Painel lateral */}
          {historico && (
            <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[calc(100vh-200px)]">
              {/* Header do painel */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-slate-800">{historico.nome}</p>
                  <button onClick={() => setHistorico(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {historico.telefone && (
                  <a href={telefoneLink(historico.telefone)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                    <Phone className="w-3 h-3" />
                    {historico.telefone} — Abrir no WhatsApp
                  </a>
                )}
                {historico.assunto && (
                  <p className="text-xs text-slate-500 mt-1">{historico.assunto}</p>
                )}

                {/* Tags no painel */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {(historico.tags || []).map(tag => {
                    const t = tagInfo(tag)
                    return (
                      <span key={tag} className={`text-xs px-1.5 py-0.5 rounded border font-medium ${t.cor} flex items-center gap-1`}>
                        {t.label}
                        <button onClick={() => toggleTag(historico.id, tag, historico.tags || [])} className="opacity-60 hover:opacity-100">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )
                  })}
                  <div className="relative">
                    <button
                      onClick={() => setShowTagsCard(showTagsCard === historico.id + '_panel' ? null : historico.id + '_panel')}
                      className="text-xs px-1.5 py-0.5 border border-dashed border-slate-300 rounded text-slate-400 hover:text-slate-600"
                    >
                      <Tag className="w-3 h-3 inline mr-0.5" />
                      + tag
                    </button>
                    {showTagsCard === historico.id + '_panel' && (
                      <div className="absolute left-0 top-7 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 w-36">
                        {TAGS_DISPONIVEIS.map(t => (
                          <button
                            key={t.id}
                            onClick={() => toggleTag(historico.id, t.id, historico.tags || [])}
                            className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-1.5 mb-0.5 ${historico.tags?.includes(t.id) ? t.cor : 'hover:bg-slate-50 text-slate-600'}`}
                          >
                            {historico.tags?.includes(t.id) && <Check className="w-3 h-3" />}
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lembrete */}
                <div className="mt-3 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <input
                    type="datetime-local"
                    value={lembreteInput}
                    onChange={e => setLembreteInput(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    onClick={salvarLembrete}
                    disabled={salvandoLembrete}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-1 rounded transition-colors"
                  >
                    {salvandoLembrete ? '...' : <Check className="w-3 h-3" />}
                  </button>
                  {lembreteInput && (
                    <button
                      onClick={() => { setLembreteInput(''); salvarLembrete() }}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Histórico de mensagens */}
              <div ref={mensagensRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {(!historico.mensagens || historico.mensagens.length === 0) ? (
                  <p className="text-xs text-slate-400 text-center py-8">Sem mensagens registradas</p>
                ) : (
                  historico.mensagens.map((msg, i) => (
                    <div key={i} className={`rounded-lg p-3 ${msg.de === 'Você' ? 'bg-blue-50 ml-4' : 'bg-slate-50 mr-4'}`}>
                      <p className="text-xs text-slate-800 whitespace-pre-wrap">{msg.texto}</p>
                      <p className="text-xs text-slate-400 mt-1">{msg.de} · {horaRelativa(msg.timestamp)}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Campo de resposta */}
              {historico.whatsapp_jid ? (
                <div className="p-3 border-t border-slate-100">
                  {erroEnvio && (
                    <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-red-600">{erroEnvio}</p>
                      <button onClick={() => setErroEnvio(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {/* Respostas rápidas dropdown */}
                  {showRespostas && respostas.length > 0 && (
                    <div className="mb-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {respostas.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setResposta(r.mensagem); setShowRespostas(false) }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                        >
                          <p className="text-xs font-medium text-slate-700">{r.titulo}</p>
                          <p className="text-xs text-slate-500 truncate">{r.mensagem}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRespostas(!showRespostas)}
                      className="text-yellow-500 hover:text-yellow-600 border border-slate-200 hover:bg-slate-50 px-2 rounded-lg transition-colors"
                      title="Respostas rápidas"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <textarea
                      value={resposta}
                      onChange={e => setResposta(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarResposta() } }}
                      placeholder="Digite... (Enter para enviar)"
                      rows={2}
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />
                    <button
                      onClick={enviarResposta}
                      disabled={enviando || !resposta.trim()}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 text-center">Atendimento manual · sem WhatsApp vinculado</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Atendimento */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-5">Novo Atendimento Manual</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Cliente *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefone / WhatsApp</label>
                <input type="text" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(21) 99999-9999"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assunto / Observação</label>
                <textarea value={form.assunto} onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))}
                  placeholder="Descreva o assunto..." rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModal(false); setForm({ nome: '', telefone: '', assunto: '' }) }}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2 rounded-lg text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Respostas Rápidas */}
      {modalRespostas && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Respostas Rápidas
              </h2>
              <button onClick={() => { setModalRespostas(false); setFormResposta({ titulo: '', mensagem: '' }); setEditandoResposta(null) }}
                className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form de criação/edição */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-slate-600">{editandoResposta ? 'Editar resposta' : 'Nova resposta'}</p>
              <input
                type="text"
                value={formResposta.titulo}
                onChange={e => setFormResposta(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Título (ex: Saudação inicial)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <textarea
                value={formResposta.mensagem}
                onChange={e => setFormResposta(f => ({ ...f, mensagem: e.target.value }))}
                placeholder="Mensagem..."
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              />
              <div className="flex gap-2">
                {editandoResposta && (
                  <button
                    onClick={() => { setEditandoResposta(null); setFormResposta({ titulo: '', mensagem: '' }) }}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={salvarResposta}
                  disabled={!formResposta.titulo.trim() || !formResposta.mensagem.trim()}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {editandoResposta ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </div>

            {/* Lista de respostas */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {respostas.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhuma resposta rápida cadastrada</p>
              ) : (
                respostas.map(r => (
                  <div key={r.id} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{r.titulo}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{r.mensagem}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditandoResposta(r.id); setFormResposta({ titulo: r.titulo, mensagem: r.mensagem }) }}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => excluirResposta(r.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
