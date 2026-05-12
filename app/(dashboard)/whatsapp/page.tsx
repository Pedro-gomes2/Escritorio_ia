'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, MessageSquare, Phone, RefreshCw, MessageCircle,
  Clock, Wifi, WifiOff, QrCode, Send, Zap, Bell, Tag, X, Check,
  Pencil, Search, BarChart2, Calendar, Settings, User, FileText,
  Circle, ChevronDown, ChevronUp, AlarmClock, Palette,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KanbanColuna {
  id: string; chave: string; nome: string; cor: string; ordem: number
}
interface Mensagem { texto: string; timestamp: string; de: string }
interface MensagemAgendada {
  id: string; atendimento_id: string; mensagem: string
  enviar_em: string; enviado: boolean
}
interface Atendimento {
  id: string; nome: string; telefone: string | null; assunto: string | null
  coluna: string; created_at: string; mensagens: Mensagem[]
  ultima_mensagem: string | null; ultimo_contato: string | null
  whatsapp_jid: string | null; tags: string[]
  lembrete: string | null; responsavel: string | null
  nao_lido: boolean; notas: string | null
}
interface RespostaRapida { id: string; titulo: string; mensagem: string }

// ─── Constants ───────────────────────────────────────────────────────────────

const TAGS_DISPONIVEIS = [
  { id: 'urgente',     label: 'Urgente',     cor: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'lead',        label: 'Lead',        cor: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'trabalhista', label: 'Trabalhista', cor: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'familia',     label: 'Família',     cor: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'imovel',      label: 'Imóvel',      cor: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: 'criminal',    label: 'Criminal',    cor: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'empresarial', label: 'Empresarial', cor: 'bg-teal-100 text-teal-700 border-teal-200' },
]

const CORES_COLUNA: Record<string, { border: string; bg: string; badge: string; emoji: string; hex: string }> = {
  yellow: { border: 'border-yellow-400', bg: 'bg-yellow-50',  badge: 'bg-yellow-200 text-yellow-800',  emoji: '🟡', hex: '#facc15' },
  blue:   { border: 'border-blue-400',   bg: 'bg-blue-50',    badge: 'bg-blue-200 text-blue-800',      emoji: '🔵', hex: '#60a5fa' },
  orange: { border: 'border-orange-400', bg: 'bg-orange-50',  badge: 'bg-orange-200 text-orange-800',  emoji: '🟠', hex: '#fb923c' },
  green:  { border: 'border-green-400',  bg: 'bg-green-50',   badge: 'bg-green-200 text-green-800',    emoji: '🟢', hex: '#4ade80' },
  purple: { border: 'border-purple-400', bg: 'bg-purple-50',  badge: 'bg-purple-200 text-purple-800',  emoji: '🟣', hex: '#c084fc' },
  red:    { border: 'border-red-400',    bg: 'bg-red-50',     badge: 'bg-red-200 text-red-800',        emoji: '🔴', hex: '#f87171' },
  teal:   { border: 'border-teal-400',   bg: 'bg-teal-50',    badge: 'bg-teal-200 text-teal-800',      emoji: '🩵', hex: '#2dd4bf' },
  pink:   { border: 'border-pink-400',   bg: 'bg-pink-50',    badge: 'bg-pink-200 text-pink-800',      emoji: '🩷', hex: '#f472b6' },
  slate:  { border: 'border-slate-400',  bg: 'bg-slate-50',   badge: 'bg-slate-200 text-slate-800',    emoji: '⚫', hex: '#94a3b8' },
}

const COLUNAS_DEFAULT: KanbanColuna[] = [
  { id: '1', chave: 'novo',       nome: 'Novo Contato',       cor: 'yellow', ordem: 0 },
  { id: '2', chave: 'atendendo',  nome: 'Em Atendimento',     cor: 'blue',   ordem: 1 },
  { id: '3', chave: 'aguardando', nome: 'Aguardando Cliente', cor: 'orange', ordem: 2 },
  { id: '4', chave: 'finalizado', nome: 'Finalizado',         cor: 'green',  ordem: 3 },
]

function tagInfo(id: string) {
  return TAGS_DISPONIVEIS.find(t => t.id === id) ?? { id, label: id, cor: 'bg-slate-100 text-slate-700 border-slate-200' }
}

function telefoneLink(tel: string) {
  const n = tel.replace(/\D/g, '')
  return `https://wa.me/${n.startsWith('55') ? n : '55' + n}`
}

function horaRelativa(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('pt-BR')
}

function horasDesde(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 3600000
}

function cardBorderUrgencia(card: Atendimento, finalizadoChave: string): string {
  if (card.coluna === finalizadoChave) return 'border-slate-200'
  const ref = card.ultimo_contato || card.created_at
  const h = horasDesde(ref)
  if (h > 24) return 'border-red-400'
  if (h > 1) return 'border-yellow-400'
  return 'border-slate-200'
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WhatsappPage() {
  const supabase = createClient()

  // Core data
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [colunas, setColunas] = useState<KanbanColuna[]>(COLUNAS_DEFAULT)
  const [respostas, setRespostas] = useState<RespostaRapida[]>([])
  const [agendamentos, setAgendamentos] = useState<MensagemAgendada[]>([])
  const [loading, setLoading] = useState(true)

  // Selection
  const [historico, setHistorico] = useState<Atendimento | null>(null)

  // Filters
  const [busca, setBusca] = useState('')
  const [filtroTag, setFiltroTag] = useState<string | null>(null)

  // UI toggles
  const [showDashboard, setShowDashboard] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [loadingQR, setLoadingQR] = useState(false)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalRespostas, setModalRespostas] = useState(false)
  const [modalColunas, setModalColunas] = useState(false)
  const [showRespostas, setShowRespostas] = useState(false)
  const [showTagsId, setShowTagsId] = useState<string | null>(null)
  const [modalAgendar, setModalAgendar] = useState(false)

  // Forms
  const [formNovo, setFormNovo] = useState({ nome: '', telefone: '', assunto: '' })
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [formResposta, setFormResposta] = useState({ titulo: '', mensagem: '' })
  const [editandoResposta, setEditandoResposta] = useState<string | null>(null)
  const [formColuna, setFormColuna] = useState({ nome: '', cor: 'blue' })
  const [editandoColuna, setEditandoColuna] = useState<string | null>(null)

  // Side panel inputs
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [lembreteInput, setLembreteInput] = useState('')
  const [salvandoLembrete, setSalvandoLembrete] = useState(false)
  const [notasInput, setNotasInput] = useState('')
  const [salvandoNotas, setSalvandoNotas] = useState(false)
  const [responsavelInput, setResponsavelInput] = useState('')
  const [salvandoResponsavel, setSalvandoResponsavel] = useState(false)
  const [agendarInput, setAgendarInput] = useState({ mensagem: '', enviar_em: '' })
  const [salvandoAgendar, setSalvandoAgendar] = useState(false)
  const [telefoneInput, setTelefoneInput] = useState('')
  const [salvandoTelefone, setSalvandoTelefone] = useState(false)

  // Evolution API
  const [evoStatus, setEvoStatus] = useState<{ qrcode?: { base64?: string }; instance?: { state?: string }; base64?: string; state?: string } | null>(null)

  // Drag & drop
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const mensagensRef = useRef<HTMLDivElement>(null)

  // ── Scroll mensagens ──
  useEffect(() => {
    if (mensagensRef.current) mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight
  }, [historico?.mensagens])

  // ── Carregamento inicial ──
  useEffect(() => {
    carregar()
    carregarColunas()
    carregarRespostas()
    processarAgendamentos()

    const channel = supabase.channel('wa_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos_whatsapp' }, () => carregar())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Atualiza historico quando atendimentos mudam
  useEffect(() => {
    if (historico) {
      const atualizado = atendimentos.find(a => a.id === historico.id)
      if (atualizado) setHistorico(atualizado)
    }
  }, [atendimentos])

  // ── Data fetchers ──
  async function carregar() {
    const { data } = await supabase
      .from('atendimentos_whatsapp')
      .select('*')
      .order('ultimo_contato', { ascending: false, nullsFirst: false })
    setAtendimentos((data as Atendimento[]) ?? [])
    setLoading(false)
  }

  async function carregarColunas() {
    const { data, error } = await supabase
      .from('kanban_colunas')
      .select('*')
      .order('ordem')
    if (!error && data && data.length > 0) setColunas(data as KanbanColuna[])
  }

  async function carregarRespostas() {
    const { data } = await supabase.from('respostas_rapidas').select('*').order('created_at')
    setRespostas((data as RespostaRapida[]) ?? [])
  }

  async function carregarAgendamentos(atendimentoId: string) {
    const { data } = await supabase
      .from('mensagens_agendadas')
      .select('*')
      .eq('atendimento_id', atendimentoId)
      .eq('enviado', false)
      .order('enviar_em')
    setAgendamentos((data as MensagemAgendada[]) ?? [])
  }

  // ── Processar agendamentos vencidos ao abrir a página ──
  async function processarAgendamentos() {
    const { data } = await supabase
      .from('mensagens_agendadas')
      .select('*, atendimentos_whatsapp(whatsapp_jid, telefone, id)')
      .eq('enviado', false)
      .lte('enviar_em', new Date().toISOString())
    if (!data?.length) return

    for (const ag of data) {
      const atend = ag.atendimentos_whatsapp as { whatsapp_jid: string | null; telefone: string | null; id: string } | null
      if (!atend) continue
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jid: atend.whatsapp_jid,
            telefone: atend.telefone,
            mensagem: ag.mensagem,
            atendimentoId: atend.id,
          }),
        })
        if (res.ok) {
          await supabase.from('mensagens_agendadas')
            .update({ enviado: true, enviado_em: new Date().toISOString() })
            .eq('id', ag.id)
        }
      } catch { /* silently continue */ }
    }
  }

  // ── Evolution API ──
  async function buscarStatusEvo() {
    setLoadingQR(true)
    try {
      const res = await fetch('/api/whatsapp/setup')
      const data = await res.json()
      setEvoStatus(data)
      setShowQR(true)
    } catch { /* silently fail */ }
    finally { setLoadingQR(false) }
  }

  const evoConectado = evoStatus?.instance?.state === 'open' || evoStatus?.state === 'open'
  const qrBase64 = evoStatus?.qrcode?.base64 || evoStatus?.base64

  // ── Enviar resposta ──
  async function enviarResposta() {
    if ((!historico?.whatsapp_jid && !historico?.telefone) || !resposta.trim()) return
    setEnviando(true)
    setErroEnvio(null)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jid: historico.whatsapp_jid ?? null,
          telefone: historico.telefone ?? null,
          mensagem: resposta.trim(),
          atendimentoId: historico.id,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const nova = { texto: resposta.trim(), timestamp: new Date().toISOString(), de: 'Você' }
        setHistorico(h => h ? { ...h, mensagens: [...(h.mensagens || []), nova], nao_lido: false } : h)
        setAtendimentos(prev => prev.map(a => a.id === historico.id
          ? { ...a, mensagens: [...(a.mensagens || []), nova], ultima_mensagem: resposta.trim() }
          : a))
        setResposta('')
        setShowRespostas(false)
      } else {
        setErroEnvio(data?.error || `Erro ${res.status}`)
      }
    } catch { setErroEnvio('Erro de conexão com o servidor') }
    finally { setEnviando(false) }
  }

  // ── Criar atendimento ──
  async function salvarNovo() {
    if (!formNovo.nome.trim()) return
    setSalvandoNovo(true)
    await supabase.from('atendimentos_whatsapp').insert({
      nome: formNovo.nome.trim(),
      telefone: formNovo.telefone.trim() || null,
      assunto: formNovo.assunto.trim() || null,
      coluna: colunas[0]?.chave ?? 'novo',
      mensagens: [], tags: [], nao_lido: false,
    })
    setFormNovo({ nome: '', telefone: '', assunto: '' })
    setModalNovo(false)
    setSalvandoNovo(false)
    carregar()
  }

  // ── Mover card ──
  async function moverCard(id: string, novaChave: string) {
    await supabase.from('atendimentos_whatsapp').update({ coluna: novaChave }).eq('id', id)
    setAtendimentos(prev => prev.map(a => a.id === id ? { ...a, coluna: novaChave } : a))
    if (historico?.id === id) setHistorico(h => h ? { ...h, coluna: novaChave } : h)
  }

  // ── Excluir ──
  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir atendimento de "${nome}"?`)) return
    await supabase.from('atendimentos_whatsapp').delete().eq('id', id)
    setAtendimentos(prev => prev.filter(a => a.id !== id))
    if (historico?.id === id) setHistorico(null)
  }

  // ── Tags ──
  async function toggleTag(id: string, tag: string, atual: string[]) {
    const novas = atual.includes(tag) ? atual.filter(t => t !== tag) : [...atual, tag]
    await supabase.from('atendimentos_whatsapp').update({ tags: novas }).eq('id', id)
    setAtendimentos(prev => prev.map(a => a.id === id ? { ...a, tags: novas } : a))
    if (historico?.id === id) setHistorico(h => h ? { ...h, tags: novas } : h)
  }

  // ── Não lido ──
  async function toggleNaoLido(id: string, atual: boolean) {
    await supabase.from('atendimentos_whatsapp').update({ nao_lido: !atual }).eq('id', id)
    setAtendimentos(prev => prev.map(a => a.id === id ? { ...a, nao_lido: !atual } : a))
    if (historico?.id === id) setHistorico(h => h ? { ...h, nao_lido: !atual } : h)
  }

  // ── Lembrete ──
  async function salvarLembrete() {
    if (!historico) return
    setSalvandoLembrete(true)
    const val = lembreteInput ? new Date(lembreteInput).toISOString() : null
    await supabase.from('atendimentos_whatsapp').update({ lembrete: val }).eq('id', historico.id)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, lembrete: val } : a))
    setHistorico(h => h ? { ...h, lembrete: val } : h)
    setSalvandoLembrete(false)
  }

  // ── Notas ──
  async function salvarNotas() {
    if (!historico) return
    setSalvandoNotas(true)
    await supabase.from('atendimentos_whatsapp').update({ notas: notasInput || null }).eq('id', historico.id)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, notas: notasInput || null } : a))
    setHistorico(h => h ? { ...h, notas: notasInput || null } : h)
    setSalvandoNotas(false)
  }

  // ── Responsável ──
  async function salvarResponsavel() {
    if (!historico) return
    setSalvandoResponsavel(true)
    await supabase.from('atendimentos_whatsapp').update({ responsavel: responsavelInput || null }).eq('id', historico.id)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, responsavel: responsavelInput || null } : a))
    setHistorico(h => h ? { ...h, responsavel: responsavelInput || null } : h)
    setSalvandoResponsavel(false)
  }

  // ── Telefone manual ──
  async function salvarTelefoneCard() {
    if (!historico || !telefoneInput.trim()) return
    setSalvandoTelefone(true)
    const tel = telefoneInput.trim().replace(/\D/g, '')
    await supabase.from('atendimentos_whatsapp').update({ telefone: tel }).eq('id', historico.id)
    setHistorico(h => h ? { ...h, telefone: tel } : h)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, telefone: tel } : a))
    setTelefoneInput('')
    setSalvandoTelefone(false)
  }

  // ── Agendar mensagem ──
  async function salvarAgendamento() {
    if (!historico || !agendarInput.mensagem.trim() || !agendarInput.enviar_em) return
    setSalvandoAgendar(true)
    await supabase.from('mensagens_agendadas').insert({
      atendimento_id: historico.id,
      mensagem: agendarInput.mensagem.trim(),
      enviar_em: new Date(agendarInput.enviar_em).toISOString(),
    })
    setAgendarInput({ mensagem: '', enviar_em: '' })
    setModalAgendar(false)
    carregarAgendamentos(historico.id)
    setSalvandoAgendar(false)
  }

  async function excluirAgendamento(id: string) {
    await supabase.from('mensagens_agendadas').delete().eq('id', id)
    setAgendamentos(prev => prev.filter(a => a.id !== id))
  }

  // ── Respostas rápidas CRUD ──
  async function salvarResposta() {
    if (!formResposta.titulo.trim() || !formResposta.mensagem.trim()) return
    if (editandoResposta) {
      await supabase.from('respostas_rapidas').update({ titulo: formResposta.titulo.trim(), mensagem: formResposta.mensagem.trim() }).eq('id', editandoResposta)
    } else {
      await supabase.from('respostas_rapidas').insert({ titulo: formResposta.titulo.trim(), mensagem: formResposta.mensagem.trim() })
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

  // ── Colunas CRUD ──
  async function salvarColuna() {
    if (!formColuna.nome.trim()) return
    if (editandoColuna) {
      await supabase.from('kanban_colunas').update({ nome: formColuna.nome.trim(), cor: formColuna.cor }).eq('id', editandoColuna)
    } else {
      const chave = 'col_' + Date.now().toString(36)
      const maxOrdem = Math.max(...colunas.map(c => c.ordem), 0)
      await supabase.from('kanban_colunas').insert({ chave, nome: formColuna.nome.trim(), cor: formColuna.cor, ordem: maxOrdem + 1 })
    }
    setFormColuna({ nome: '', cor: 'blue' })
    setEditandoColuna(null)
    carregarColunas()
  }

  async function excluirColuna(id: string, chave: string) {
    if (!confirm('Excluir coluna? Os cards serão movidos para a primeira coluna.')) return
    const primeiraChave = colunas.find(c => c.id !== id)?.chave ?? 'novo'
    await supabase.from('atendimentos_whatsapp').update({ coluna: primeiraChave }).eq('coluna', chave)
    await supabase.from('kanban_colunas').delete().eq('id', id)
    carregarColunas()
    carregar()
  }

  // ── Dashboard stats ──
  const stats = {
    total: atendimentos.length,
    naoLidos: atendimentos.filter(a => a.nao_lido).length,
    lembreteVencido: atendimentos.filter(a => a.lembrete && new Date(a.lembrete) <= new Date() && a.coluna !== colunas.at(-1)?.chave).length,
    semResposta24h: atendimentos.filter(a => {
      const ref = a.ultimo_contato || a.created_at
      return horasDesde(ref) > 24 && a.coluna !== colunas.at(-1)?.chave
    }).length,
    porColuna: Object.fromEntries(colunas.map(c => [c.chave, atendimentos.filter(a => a.coluna === c.chave).length])),
  }

  // ── Filter ──
  const finalizadoChave = colunas.find(c => c.cor === 'green')?.chave ?? colunas.at(-1)?.chave ?? 'finalizado'
  const atendimentosFiltrados = atendimentos.filter(a => {
    if (filtroTag && !(a.tags || []).includes(filtroTag)) return false
    if (busca) {
      const q = busca.toLowerCase()
      return a.nome.toLowerCase().includes(q) || (a.telefone ?? '').includes(q) || (a.ultima_mensagem ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const lembreteVencidos = atendimentos.filter(a => a.lembrete && new Date(a.lembrete) <= new Date() && a.coluna !== finalizadoChave)

  // ── Drag & drop handlers ──
  function onDragStart(e: React.DragEvent, cardId: string) {
    e.dataTransfer.effectAllowed = 'move'
    setDragId(cardId)
  }
  function onDragOver(e: React.DragEvent, chave: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(chave)
  }
  function onDrop(e: React.DragEvent, chave: string) {
    e.preventDefault()
    if (dragId) moverCard(dragId, chave)
    setDragId(null)
    setDragOver(null)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">Gestão WhatsApp</h1>
              {stats.naoLidos > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {stats.naoLidos} novo{stats.naoLidos > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm">+55 21 96435-3290 · Evolution API</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowDashboard(!showDashboard)}
            className={`flex items-center gap-1.5 border px-3 py-2 rounded-lg text-sm transition-colors ${showDashboard ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <BarChart2 className="w-3.5 h-3.5" />Dashboard
          </button>
          <button onClick={() => setModalRespostas(true)}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />Respostas
          </button>
          <button onClick={() => setModalColunas(true)}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors">
            <Settings className="w-3.5 h-3.5" />Colunas
          </button>
          <button onClick={buscarStatusEvo} disabled={loadingQR}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
            <QrCode className="w-3.5 h-3.5" />{loadingQR ? '...' : 'Conectar'}
          </button>
          <button onClick={carregar}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setModalNovo(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />Novo
          </button>
        </div>
      </div>

      {/* ── Mini Dashboard ── */}
      {showDashboard && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total atendimentos</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Não lidos</p>
            <p className="text-2xl font-bold text-red-600">{stats.naoLidos}</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Lembretes vencidos</p>
            <p className="text-2xl font-bold text-amber-600">{stats.lembreteVencido}</p>
          </div>
          <div className="bg-white rounded-xl border border-orange-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Sem resposta +24h</p>
            <p className="text-2xl font-bold text-orange-600">{stats.semResposta24h}</p>
          </div>
          {colunas.map(col => {
            const c = CORES_COLUNA[col.cor] ?? CORES_COLUNA.slate
            return (
              <div key={col.id} className={`bg-white rounded-xl border ${c.border} p-4`}>
                <p className="text-xs text-slate-500 mb-1">{col.nome}</p>
                <p className="text-2xl font-bold text-slate-800">{stats.porColuna[col.chave] ?? 0}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Lembretes vencidos ── */}
      {lembreteVencidos.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <Bell className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">
              {lembreteVencidos.length} lembrete{lembreteVencidos.length > 1 ? 's' : ''} vencido{lembreteVencidos.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {lembreteVencidos.map(a => (
                <button key={a.id} onClick={() => { setHistorico(a); setLembreteInput(a.lembrete ? new Date(a.lembrete).toISOString().slice(0, 16) : '') }}
                  className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded-lg transition-colors font-medium">
                  {a.nome} · {a.lembrete ? new Date(a.lembrete).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── QR Code ── */}
      {showQR && (
        <div className="mb-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {evoConectado
                ? <><Wifi className="w-4 h-4 text-green-500" /><span className="font-semibold text-green-700 text-sm">WhatsApp conectado!</span></>
                : <><WifiOff className="w-4 h-4 text-amber-500" /><span className="font-semibold text-amber-700 text-sm">Escaneie o QR Code</span></>}
            </div>
            <button onClick={() => setShowQR(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          {evoConectado ? (
            <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700">✅ Número <strong>+55 21 96435-3290</strong> conectado.</div>
          ) : qrBase64 ? (
            <div className="flex items-start gap-6">
              <img src={qrBase64} alt="QR Code" className="w-40 h-40 border border-slate-200 rounded-lg" />
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-500 mt-2">
                <li>Abra o WhatsApp no celular</li>
                <li>Configurações → Aparelhos Conectados</li>
                <li>Conectar um aparelho → escaneie</li>
              </ol>
            </div>
          ) : <p className="text-sm text-slate-500">Carregando QR Code...</p>}
        </div>
      )}

      {/* ── Busca + Filtro por tag ── */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou mensagem..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setFiltroTag(null)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-medium ${!filtroTag ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Todos
          </button>
          {TAGS_DISPONIVEIS.map(t => (
            <button key={t.id} onClick={() => setFiltroTag(filtroTag === t.id ? null : t.id)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-medium ${filtroTag === t.id ? t.cor + ' border-current' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="flex gap-4">
          {/* ── Kanban ── */}
          <div className="flex gap-3 flex-1 min-w-0 overflow-x-auto pb-2">
            {colunas.map(col => {
              const c = CORES_COLUNA[col.cor] ?? CORES_COLUNA.slate
              const cards = atendimentosFiltrados.filter(a => a.coluna === col.chave)
              const isOver = dragOver === col.chave
              return (
                <div
                  key={col.id}
                  className={`rounded-xl border-2 ${c.border} ${c.bg} p-3 flex-shrink-0 w-64 transition-all ${isOver ? 'ring-2 ring-offset-1 ring-blue-400 scale-[1.01]' : ''}`}
                  onDragOver={e => onDragOver(e, col.chave)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => onDrop(e, col.chave)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-700">{c.emoji} {col.nome}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{cards.length}</span>
                  </div>

                  <div className="space-y-2">
                    {cards.map(card => {
                      const border = cardBorderUrgencia(card, finalizadoChave)
                      const temLembreteAtivo = card.lembrete && new Date(card.lembrete) > new Date()
                      const lembreteVenc = card.lembrete && new Date(card.lembrete) <= new Date()
                      const hSemResposta = horasDesde(card.ultimo_contato || card.created_at)
                      return (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={e => onDragStart(e, card.id)}
                          onDragEnd={() => { setDragId(null); setDragOver(null) }}
                          className={`bg-white rounded-lg border-2 shadow-sm p-3 cursor-grab active:cursor-grabbing transition-all ${historico?.id === card.id ? 'border-blue-400 ring-2 ring-blue-200' : border + ' hover:border-slate-300'} ${dragId === card.id ? 'opacity-40' : ''}`}
                          onClick={() => {
                            const sel = historico?.id === card.id ? null : card
                            setHistorico(sel)
                            if (sel) {
                              setLembreteInput(sel.lembrete ? new Date(sel.lembrete).toISOString().slice(0, 16) : '')
                              setNotasInput(sel.notas ?? '')
                              setResponsavelInput(sel.responsavel ?? '')
                              setTelefoneInput('')
                              carregarAgendamentos(sel.id)
                              if (sel.nao_lido) toggleNaoLido(sel.id, true)
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              {card.nao_lido && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                              {(temLembreteAtivo || lembreteVenc) && (
                                <Bell className={`w-3 h-3 flex-shrink-0 ${lembreteVenc ? 'text-red-500' : 'text-amber-500'}`} />
                              )}
                              <p className="font-medium text-slate-800 text-xs leading-tight truncate">{card.nome}</p>
                            </div>
                            <button onClick={e => { e.stopPropagation(); excluir(card.id, card.nome) }}
                              className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {card.telefone && (
                            <a href={telefoneLink(card.telefone)} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-green-600 hover:underline mb-1">
                              <Phone className="w-2.5 h-2.5" />{card.telefone}
                            </a>
                          )}

                          {card.ultima_mensagem && (
                            <p className="text-xs text-slate-500 line-clamp-1 mb-1">{card.ultima_mensagem}</p>
                          )}

                          {card.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {card.tags.map(t => {
                                const ti = tagInfo(t)
                                return <span key={t} className={`text-xs px-1 py-0.5 rounded border font-medium ${ti.cor}`}>{ti.label}</span>
                              })}
                            </div>
                          )}

                          {card.responsavel && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                              <User className="w-2.5 h-2.5" />{card.responsavel}
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-1">
                            {card.mensagens?.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <MessageCircle className="w-2.5 h-2.5" />{card.mensagens.length}
                              </span>
                            )}
                            <span className={`flex items-center gap-1 text-xs ml-auto ${hSemResposta > 24 ? 'text-red-500 font-medium' : hSemResposta > 1 ? 'text-yellow-600' : 'text-slate-400'}`}>
                              <Clock className="w-2.5 h-2.5" />
                              {card.ultimo_contato ? horaRelativa(card.ultimo_contato) : horaRelativa(card.created_at)}
                            </span>
                          </div>

                          {/* Actions bar */}
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                            {/* Tag */}
                            <div className="relative">
                              <button onClick={e => { e.stopPropagation(); setShowTagsId(showTagsId === card.id ? null : card.id) }}
                                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1 rounded transition-colors">
                                <Tag className="w-3 h-3" />
                              </button>
                              {showTagsId === card.id && (
                                <div className="absolute left-0 top-7 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 w-36" onClick={e => e.stopPropagation()}>
                                  {TAGS_DISPONIVEIS.map(t => (
                                    <button key={t.id} onClick={() => toggleTag(card.id, t.id, card.tags || [])}
                                      className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-1.5 mb-0.5 ${card.tags?.includes(t.id) ? t.cor : 'hover:bg-slate-50 text-slate-600'}`}>
                                      {card.tags?.includes(t.id) && <Check className="w-3 h-3" />}{t.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Não lido toggle */}
                            <button onClick={e => { e.stopPropagation(); toggleNaoLido(card.id, card.nao_lido) }}
                              className={`p-1 rounded transition-colors ${card.nao_lido ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
                              title={card.nao_lido ? 'Marcar como lido' : 'Marcar como não lido'}>
                              <Circle className="w-3 h-3" />
                            </button>
                            {/* Mover colunas */}
                            {colunas.findIndex(c => c.chave === card.coluna) > 0 && (
                              <button onClick={e => { e.stopPropagation(); const idx = colunas.findIndex(c => c.chave === card.coluna); moverCard(card.id, colunas[idx - 1].chave) }}
                                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1 rounded transition-colors ml-auto">
                                ◀
                              </button>
                            )}
                            {colunas.findIndex(c => c.chave === card.coluna) < colunas.length - 1 && (
                              <button onClick={e => { e.stopPropagation(); const idx = colunas.findIndex(c => c.chave === card.coluna); moverCard(card.id, colunas[idx + 1].chave) }}
                                className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1 rounded transition-colors">
                                ▶
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {cards.length === 0 && (
                      <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isOver ? 'border-blue-400 bg-blue-50' : 'border-transparent'}`}>
                        <p className="text-xs text-slate-400">{isOver ? 'Soltar aqui' : 'Vazio'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Painel lateral ── */}
          {historico && (
            <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[calc(100vh-180px)]">
              {/* Header painel */}
              <div className="p-4 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800 truncate flex-1">{historico.nome}</p>
                  <button onClick={() => setHistorico(null)} className="text-slate-400 hover:text-slate-600 ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Telefone */}
                {historico.telefone ? (
                  <a href={telefoneLink(historico.telefone)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                    <Phone className="w-3 h-3" />{historico.telefone} — Abrir no WhatsApp
                  </a>
                ) : historico.whatsapp_jid ? (
                  <div className="flex items-center gap-1">
                    <input value={telefoneInput} onChange={e => setTelefoneInput(e.target.value)}
                      placeholder="Adicionar telefone (5521...)"
                      className="flex-1 text-xs border border-amber-300 bg-amber-50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    <button onClick={salvarTelefoneCard} disabled={salvandoTelefone || !telefoneInput.trim()}
                      className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded disabled:opacity-50">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}

                {historico.assunto && <p className="text-xs text-slate-500">{historico.assunto}</p>}

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {(historico.tags || []).map(t => {
                    const ti = tagInfo(t)
                    return (
                      <span key={t} className={`text-xs px-1.5 py-0.5 rounded border font-medium ${ti.cor} flex items-center gap-1`}>
                        {ti.label}
                        <button onClick={() => toggleTag(historico.id, t, historico.tags || [])} className="opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )
                  })}
                  <div className="relative">
                    <button onClick={() => setShowTagsId(showTagsId === historico.id + 'p' ? null : historico.id + 'p')}
                      className="text-xs px-1.5 py-0.5 border border-dashed border-slate-300 rounded text-slate-400 hover:text-slate-600">
                      <Tag className="w-3 h-3 inline mr-0.5" />+ tag
                    </button>
                    {showTagsId === historico.id + 'p' && (
                      <div className="absolute left-0 top-7 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 w-36">
                        {TAGS_DISPONIVEIS.map(t => (
                          <button key={t.id} onClick={() => toggleTag(historico.id, t.id, historico.tags || [])}
                            className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-1.5 mb-0.5 ${historico.tags?.includes(t.id) ? t.cor : 'hover:bg-slate-50 text-slate-600'}`}>
                            {historico.tags?.includes(t.id) && <Check className="w-3 h-3" />}{t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Responsável */}
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <input value={responsavelInput} onChange={e => setResponsavelInput(e.target.value)}
                    onBlur={salvarResponsavel}
                    placeholder="Responsável..."
                    className="flex-1 text-xs border-0 border-b border-slate-200 focus:outline-none focus:border-blue-400 py-0.5 bg-transparent" />
                  {salvandoResponsavel && <span className="text-xs text-slate-400">...</span>}
                </div>

                {/* Lembrete */}
                <div className="flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <input type="datetime-local" value={lembreteInput} onChange={e => setLembreteInput(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                  <button onClick={salvarLembrete} disabled={salvandoLembrete}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 p-1 rounded transition-colors">
                    {salvandoLembrete ? '...' : <Check className="w-3 h-3" />}
                  </button>
                  {lembreteInput && (
                    <button onClick={() => { setLembreteInput(''); salvarLembrete() }} className="text-slate-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Notas internas */}
                <div>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3" />Notas internas
                  </p>
                  <textarea value={notasInput} onChange={e => setNotasInput(e.target.value)}
                    onBlur={salvarNotas}
                    placeholder="Anotações visíveis só para a equipe..."
                    rows={2}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                </div>

                {/* Agendamentos */}
                {agendamentos.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                      <AlarmClock className="w-3 h-3 text-blue-500" />Mensagens agendadas
                    </p>
                    {agendamentos.map(ag => (
                      <div key={ag.id} className="flex items-start gap-1 mb-1 bg-blue-50 rounded p-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 truncate">{ag.mensagem}</p>
                          <p className="text-xs text-blue-500">{new Date(ag.enviar_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <button onClick={() => excluirAgendamento(ag.id)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Histórico mensagens */}
              <div ref={mensagensRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {(!historico.mensagens || historico.mensagens.length === 0) ? (
                  <p className="text-xs text-slate-400 text-center py-8">Sem mensagens</p>
                ) : (
                  historico.mensagens.map((msg, i) => (
                    <div key={i} className={`rounded-lg p-2.5 ${msg.de === 'Você' ? 'bg-blue-50 ml-6' : 'bg-slate-50 mr-6'}`}>
                      <p className="text-xs text-slate-800 whitespace-pre-wrap">{msg.texto}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{msg.de} · {horaRelativa(msg.timestamp)}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Campo resposta */}
              {(historico.whatsapp_jid || historico.telefone) ? (
                <div className="p-3 border-t border-slate-100">
                  {erroEnvio && (
                    <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 flex items-center justify-between gap-2">
                      <p className="text-xs text-red-600">{erroEnvio}</p>
                      <button onClick={() => setErroEnvio(null)}><X className="w-3 h-3 text-red-400" /></button>
                    </div>
                  )}
                  {showRespostas && respostas.length > 0 && (
                    <div className="mb-2 bg-white border border-slate-200 rounded-lg shadow max-h-36 overflow-y-auto">
                      {respostas.map(r => (
                        <button key={r.id} onClick={() => { setResposta(r.mensagem); setShowRespostas(false) }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <p className="text-xs font-medium text-slate-700">{r.titulo}</p>
                          <p className="text-xs text-slate-500 truncate">{r.mensagem}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <button onClick={() => setShowRespostas(!showRespostas)}
                      className="text-yellow-500 hover:text-yellow-600 border border-slate-200 hover:bg-slate-50 px-2 rounded-lg" title="Respostas rápidas">
                      <Zap className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setModalAgendar(true); setAgendarInput({ mensagem: '', enviar_em: '' }) }}
                      className="text-blue-500 hover:text-blue-600 border border-slate-200 hover:bg-slate-50 px-2 rounded-lg" title="Agendar mensagem">
                      <Calendar className="w-4 h-4" />
                    </button>
                    <textarea value={resposta} onChange={e => setResposta(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarResposta() } }}
                      placeholder="Digite... (Enter envia)"
                      rows={2}
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                    <button onClick={enviarResposta} disabled={enviando || !resposta.trim()}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 rounded-lg transition-colors disabled:opacity-50">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 text-center">Sem telefone cadastrado</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Novo Atendimento ── */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-5">Novo Atendimento</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                <input type="text" value={formNovo.nome} onChange={e => setFormNovo(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome do cliente"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefone / WhatsApp</label>
                <input type="text" value={formNovo.telefone} onChange={e => setFormNovo(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(21) 99999-9999"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assunto</label>
                <textarea value={formNovo.assunto} onChange={e => setFormNovo(f => ({ ...f, assunto: e.target.value }))}
                  rows={3} placeholder="Descreva o assunto..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setModalNovo(false); setFormNovo({ nome: '', telefone: '', assunto: '' }) }}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2 rounded-lg text-sm transition-colors">Cancelar</button>
              <button onClick={salvarNovo} disabled={salvandoNovo || !formNovo.nome.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {salvandoNovo ? 'Salvando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Agendar Mensagem ── */}
      {modalAgendar && historico && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />Agendar Mensagem
              </h2>
              <button onClick={() => setModalAgendar(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Para: <strong>{historico.nome}</strong></p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mensagem *</label>
                <textarea value={agendarInput.mensagem} onChange={e => setAgendarInput(f => ({ ...f, mensagem: e.target.value }))}
                  rows={3} placeholder="Mensagem que será enviada..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data e hora de envio *</label>
                <input type="datetime-local" value={agendarInput.enviar_em} onChange={e => setAgendarInput(f => ({ ...f, enviar_em: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-xs text-slate-400">⚠️ A mensagem será enviada automaticamente quando você abrir a página após o horário agendado.</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalAgendar(false)}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2 rounded-lg text-sm transition-colors">Cancelar</button>
              <button onClick={salvarAgendamento} disabled={salvandoAgendar || !agendarInput.mensagem.trim() || !agendarInput.enviar_em}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {salvandoAgendar ? 'Agendando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Respostas Rápidas ── */}
      {modalRespostas && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />Respostas Rápidas
              </h2>
              <button onClick={() => { setModalRespostas(false); setFormResposta({ titulo: '', mensagem: '' }); setEditandoResposta(null) }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs font-semibold text-slate-600">{editandoResposta ? 'Editar' : 'Nova resposta'}</p>
              <input value={formResposta.titulo} onChange={e => setFormResposta(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Título" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              <textarea value={formResposta.mensagem} onChange={e => setFormResposta(f => ({ ...f, mensagem: e.target.value }))}
                placeholder="Mensagem..." rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
              <div className="flex gap-2">
                {editandoResposta && (
                  <button onClick={() => { setEditandoResposta(null); setFormResposta({ titulo: '', mensagem: '' }) }}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
                )}
                <button onClick={salvarResposta} disabled={!formResposta.titulo.trim() || !formResposta.mensagem.trim()}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  {editandoResposta ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {respostas.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhuma resposta cadastrada</p>
              ) : respostas.map(r => (
                <div key={r.id} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{r.titulo}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{r.mensagem}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditandoResposta(r.id); setFormResposta({ titulo: r.titulo, mensagem: r.mensagem }) }}
                      className="text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => excluirResposta(r.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Gerenciar Colunas ── */}
      {modalColunas && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5" />Gerenciar Colunas
              </h2>
              <button onClick={() => { setModalColunas(false); setFormColuna({ nome: '', cor: 'blue' }); setEditandoColuna(null) }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Form nova coluna */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs font-semibold text-slate-600">{editandoColuna ? 'Editar coluna' : 'Nova coluna'}</p>
              <input value={formColuna.nome} onChange={e => setFormColuna(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome da coluna"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <div>
                <p className="text-xs text-slate-500 mb-1">Cor</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(CORES_COLUNA).map(([cor, cfg]) => (
                    <button key={cor} onClick={() => setFormColuna(f => ({ ...f, cor }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${formColuna.cor === cor ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: cfg.hex }} title={cor} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {editandoColuna && (
                  <button onClick={() => { setEditandoColuna(null); setFormColuna({ nome: '', cor: 'blue' }) }}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
                )}
                <button onClick={salvarColuna} disabled={!formColuna.nome.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  {editandoColuna ? 'Salvar' : 'Adicionar coluna'}
                </button>
              </div>
            </div>

            {/* Lista de colunas */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {colunas.map(col => {
                const c = CORES_COLUNA[col.cor] ?? CORES_COLUNA.slate
                return (
                  <div key={col.id} className={`border-2 ${c.border} rounded-lg p-3 flex items-center justify-between gap-2`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{c.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{col.nome}</p>
                        <p className="text-xs text-slate-400">{stats.porColuna[col.chave] ?? 0} atendimento{(stats.porColuna[col.chave] ?? 0) !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditandoColuna(col.id); setFormColuna({ nome: col.nome, cor: col.cor }) }}
                        className="text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => excluirColuna(col.id, col.chave)}
                        className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
