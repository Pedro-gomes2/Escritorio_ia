'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronRight, ChevronLeft, MessageSquare, Phone, RefreshCw, MessageCircle, Clock, Wifi, WifiOff, QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Coluna = 'novo' | 'atendendo' | 'aguardando' | 'finalizado'

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
  const supabase = createClient()

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

  async function carregar() {
    const { data } = await supabase
      .from('atendimentos_whatsapp')
      .select('*')
      .order('ultimo_contato', { ascending: false, nullsFirst: false })
    setAtendimentos((data as Atendimento[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // Realtime: atualiza ao receber nova mensagem
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
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir atendimento de "${nome}"?`)) return
    await supabase.from('atendimentos_whatsapp').delete().eq('id', id)
    setAtendimentos(prev => prev.filter(a => a.id !== id))
    if (historico?.id === id) setHistorico(null)
  }

  const novosCount = atendimentos.filter(a => a.coluna === 'novo').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">Gestão WhatsApp</h1>
              {novosCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{novosCount} novo{novosCount > 1 ? 's' : ''}</span>
              )}
            </div>
            <p className="text-slate-500 text-sm">+55 21 96435-3290 · Evolution API</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={buscarStatusEvo} disabled={loadingQR}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
            <QrCode className="w-3.5 h-3.5" />
            {loadingQR ? 'Aguarde...' : 'Conectar WhatsApp'}
          </button>
          <button onClick={carregar} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Novo
          </button>
        </div>
      </div>

      {/* Banner status Evolution API */}
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
              ✅ Número <strong>+55 21 96435-3290</strong> conectado. Mensagens recebidas aparecerão automaticamente no kanban abaixo.
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
                <button onClick={buscarStatusEvo} className="text-xs text-blue-600 hover:underline mt-2">
                  ↺ Atualizar QR Code
                </button>
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
          {/* Kanban */}
          <div className={`grid gap-4 flex-1 ${historico ? 'grid-cols-4' : 'grid-cols-4'}`}>
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
                    {cards.map(card => (
                      <div
                        key={card.id}
                        className={`bg-white rounded-lg border shadow-sm p-3 cursor-pointer transition-all ${historico?.id === card.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
                        onClick={() => setHistorico(historico?.id === card.id ? null : card)}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="font-medium text-slate-800 text-xs leading-tight flex-1">{card.nome}</p>
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
                    ))}

                    {cards.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">Vazio</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Painel de histórico de mensagens */}
          {historico && (
            <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-slate-800">{historico.nome}</p>
                  <button onClick={() => setHistorico(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                </div>
                {historico.telefone && (
                  <a href={telefoneLink(historico.telefone)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                    <Phone className="w-3 h-3" />
                    Abrir no WhatsApp
                  </a>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96">
                {(!historico.mensagens || historico.mensagens.length === 0) ? (
                  <p className="text-xs text-slate-400 text-center py-8">Sem mensagens registradas</p>
                ) : (
                  historico.mensagens.map((msg, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-800">{msg.texto}</p>
                      <p className="text-xs text-slate-400 mt-1">{msg.de} · {horaRelativa(msg.timestamp)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal novo atendimento */}
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
    </div>
  )
}
