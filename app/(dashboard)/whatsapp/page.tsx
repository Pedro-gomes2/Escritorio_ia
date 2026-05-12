'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, MessageSquare, Phone, Send, Zap, Bell, Tag, X, Check,
  Pencil, Search, Calendar, User, FileText, AlarmClock, Circle,
  QrCode, Wifi, WifiOff, RefreshCw, ChevronDown, MoreVertical,
  Settings, Clock, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KanbanColuna { id: string; chave: string; nome: string; cor: string; ordem: number }
interface Mensagem { texto: string; timestamp: string; de: string }
interface MensagemAgendada { id: string; atendimento_id: string; mensagem: string; enviar_em: string; enviado: boolean }
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

const CORES: Record<string, { border: string; bg: string; badge: string; dot: string; tab: string }> = {
  yellow: { border: 'border-l-yellow-400', bg: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-800',  dot: 'bg-yellow-400', tab: 'text-yellow-700 border-yellow-400' },
  blue:   { border: 'border-l-blue-400',   bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-400',   tab: 'text-blue-700 border-blue-400' },
  orange: { border: 'border-l-orange-400', bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-800',  dot: 'bg-orange-400', tab: 'text-orange-700 border-orange-400' },
  green:  { border: 'border-l-green-400',  bg: 'bg-green-50',   badge: 'bg-green-100 text-green-800',    dot: 'bg-green-400',  tab: 'text-green-700 border-green-400' },
  purple: { border: 'border-l-purple-400', bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-800',  dot: 'bg-purple-400', tab: 'text-purple-700 border-purple-400' },
  red:    { border: 'border-l-red-400',    bg: 'bg-red-50',     badge: 'bg-red-100 text-red-800',        dot: 'bg-red-400',    tab: 'text-red-700 border-red-400' },
  teal:   { border: 'border-l-teal-400',   bg: 'bg-teal-50',    badge: 'bg-teal-100 text-teal-800',      dot: 'bg-teal-400',   tab: 'text-teal-700 border-teal-400' },
  slate:  { border: 'border-l-slate-400',  bg: 'bg-slate-50',   badge: 'bg-slate-100 text-slate-700',    dot: 'bg-slate-400',  tab: 'text-slate-700 border-slate-400' },
}

const AVATAR_CORES = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-red-500','bg-indigo-500']

const COLUNAS_DEFAULT: KanbanColuna[] = [
  { id: '1', chave: 'novo',       nome: 'Aguardando',         cor: 'yellow', ordem: 0 },
  { id: '2', chave: 'atendendo',  nome: 'Em Andamento',       cor: 'blue',   ordem: 1 },
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
function getInitials(nome: string) {
  return nome.trim().split(' ').map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}
function getAvatarCor(nome: string) {
  return AVATAR_CORES[nome.charCodeAt(0) % AVATAR_CORES.length]
}
function formatarTelefone(tel: string) {
  const n = tel.replace(/\D/g, '')
  if (n.length === 13) return `+${n.slice(0,2)} (${n.slice(2,4)}) ${n.slice(4,9)}-${n.slice(9)}`
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
  return tel
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WhatsappPage() {
  const supabase = createClient()

  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [colunas, setColunas] = useState<KanbanColuna[]>(COLUNAS_DEFAULT)
  const [respostas, setRespostas] = useState<RespostaRapida[]>([])
  const [agendamentos, setAgendamentos] = useState<MensagemAgendada[]>([])
  const [loading, setLoading] = useState(true)
  const [historico, setHistorico] = useState<Atendimento | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroColuna, setFiltroColuna] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [loadingQR, setLoadingQR] = useState(false)
  const [evoStatus, setEvoStatus] = useState<{ qrcode?: { base64?: string }; instance?: { state?: string }; base64?: string; state?: string } | null>(null)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalRespostas, setModalRespostas] = useState(false)
  const [modalAgendar, setModalAgendar] = useState(false)
  const [showRespostas, setShowRespostas] = useState(false)
  const [showTagsMenu, setShowTagsMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [formNovo, setFormNovo] = useState({ nome: '', telefone: '', assunto: '' })
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [formResposta, setFormResposta] = useState({ titulo: '', mensagem: '' })
  const [editandoResposta, setEditandoResposta] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [lembreteInput, setLembreteInput] = useState('')
  const [salvandoLembrete, setSalvandoLembrete] = useState(false)
  const [notasInput, setNotasInput] = useState('')
  const [salvandoNotas, setSalvandoNotas] = useState(false)
  const [responsavelInput, setResponsavelInput] = useState('')
  const [telefoneInput, setTelefoneInput] = useState('')
  const [salvandoTelefone, setSalvandoTelefone] = useState(false)
  const [agendarInput, setAgendarInput] = useState({ mensagem: '', enviar_em: '' })
  const [salvandoAgendar, setSalvandoAgendar] = useState(false)

  const mensagensRef = useRef<HTMLDivElement>(null)
  const respostaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (mensagensRef.current) mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight
  }, [historico?.mensagens])

  useEffect(() => {
    carregar(); carregarColunas(); carregarRespostas(); processarAgendamentos()
    const ch = supabase.channel('wa_crm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos_whatsapp' }, () => carregar())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (historico) {
      const atualizado = atendimentos.find(a => a.id === historico.id)
      if (atualizado) setHistorico(atualizado)
    }
  }, [atendimentos])

  async function carregar() {
    const { data } = await supabase.from('atendimentos_whatsapp').select('*')
      .order('ultimo_contato', { ascending: false, nullsFirst: false })
    setAtendimentos((data as Atendimento[]) ?? [])
    setLoading(false)
  }
  async function carregarColunas() {
    const { data, error } = await supabase.from('kanban_colunas').select('*').order('ordem')
    if (!error && data?.length) setColunas(data as KanbanColuna[])
  }
  async function carregarRespostas() {
    const { data } = await supabase.from('respostas_rapidas').select('*').order('created_at')
    setRespostas((data as RespostaRapida[]) ?? [])
  }
  async function carregarAgendamentos(id: string) {
    const { data } = await supabase.from('mensagens_agendadas').select('*')
      .eq('atendimento_id', id).eq('enviado', false).order('enviar_em')
    setAgendamentos((data as MensagemAgendada[]) ?? [])
  }
  async function processarAgendamentos() {
    const { data } = await supabase.from('mensagens_agendadas')
      .select('*, atendimentos_whatsapp(whatsapp_jid, telefone, id)')
      .eq('enviado', false).lte('enviar_em', new Date().toISOString())
    for (const ag of data ?? []) {
      const atend = ag.atendimentos_whatsapp as { whatsapp_jid: string | null; telefone: string | null; id: string } | null
      if (!atend) continue
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jid: atend.whatsapp_jid, telefone: atend.telefone, mensagem: ag.mensagem, atendimentoId: atend.id }),
        })
        if (res.ok) await supabase.from('mensagens_agendadas').update({ enviado: true, enviado_em: new Date().toISOString() }).eq('id', ag.id)
      } catch { /* continue */ }
    }
  }

  async function buscarStatusEvo() {
    setLoadingQR(true)
    try { const r = await fetch('/api/whatsapp/setup'); setEvoStatus(await r.json()); setShowQR(true) }
    catch { /* fail */ } finally { setLoadingQR(false) }
  }
  const evoConectado = evoStatus?.instance?.state === 'open' || evoStatus?.state === 'open'
  const qrBase64 = evoStatus?.qrcode?.base64 || evoStatus?.base64

  function abrirConversa(a: Atendimento) {
    setHistorico(a)
    setLembreteInput(a.lembrete ? new Date(a.lembrete).toISOString().slice(0, 16) : '')
    setNotasInput(a.notas ?? '')
    setResponsavelInput(a.responsavel ?? '')
    setTelefoneInput('')
    setResposta('')
    setErroEnvio(null)
    setShowRespostas(false)
    setShowTagsMenu(false)
    setShowStatusMenu(false)
    setShowMenu(false)
    carregarAgendamentos(a.id)
    if (a.nao_lido) toggleNaoLido(a.id, true)
    setTimeout(() => respostaRef.current?.focus(), 100)
  }

  async function enviarResposta() {
    if ((!historico?.whatsapp_jid && !historico?.telefone) || !resposta.trim()) return
    setEnviando(true); setErroEnvio(null)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: historico.whatsapp_jid ?? null, telefone: historico.telefone ?? null, mensagem: resposta.trim(), atendimentoId: historico.id }),
      })
      const data = await res.json()
      if (res.ok) {
        const nova = { texto: resposta.trim(), timestamp: new Date().toISOString(), de: 'Você' }
        setHistorico(h => h ? { ...h, mensagens: [...(h.mensagens || []), nova] } : h)
        setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, mensagens: [...(a.mensagens || []), nova], ultima_mensagem: resposta.trim() } : a))
        setResposta(''); setShowRespostas(false)
      } else { setErroEnvio(data?.error || `Erro ${res.status}`) }
    } catch { setErroEnvio('Erro de conexão') } finally { setEnviando(false) }
  }

  async function salvarNovo() {
    if (!formNovo.nome.trim()) return
    setSalvandoNovo(true)
    await supabase.from('atendimentos_whatsapp').insert({
      nome: formNovo.nome.trim(), telefone: formNovo.telefone.trim() || null,
      assunto: formNovo.assunto.trim() || null, coluna: colunas[0]?.chave ?? 'novo',
      mensagens: [], tags: [], nao_lido: false,
    })
    setFormNovo({ nome: '', telefone: '', assunto: '' }); setModalNovo(false); setSalvandoNovo(false); carregar()
  }

  async function mudarStatus(id: string, chave: string) {
    await supabase.from('atendimentos_whatsapp').update({ coluna: chave }).eq('id', id)
    setAtendimentos(prev => prev.map(a => a.id === id ? { ...a, coluna: chave } : a))
    if (historico?.id === id) setHistorico(h => h ? { ...h, coluna: chave } : h)
    setShowStatusMenu(false)
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir conversa de "${nome}"?`)) return
    await supabase.from('atendimentos_whatsapp').delete().eq('id', id)
    setAtendimentos(prev => prev.filter(a => a.id !== id))
    if (historico?.id === id) setHistorico(null)
    setShowMenu(false)
  }

  async function toggleTag(tag: string) {
    if (!historico) return
    const atual = historico.tags || []
    const novas = atual.includes(tag) ? atual.filter(t => t !== tag) : [...atual, tag]
    await supabase.from('atendimentos_whatsapp').update({ tags: novas }).eq('id', historico.id)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, tags: novas } : a))
    setHistorico(h => h ? { ...h, tags: novas } : h)
  }

  async function toggleNaoLido(id: string, marcarLido: boolean) {
    const val = marcarLido ? false : true
    await supabase.from('atendimentos_whatsapp').update({ nao_lido: val }).eq('id', id)
    setAtendimentos(prev => prev.map(a => a.id === id ? { ...a, nao_lido: val } : a))
    if (historico?.id === id) setHistorico(h => h ? { ...h, nao_lido: val } : h)
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

  async function salvarNotas() {
    if (!historico) return; setSalvandoNotas(true)
    await supabase.from('atendimentos_whatsapp').update({ notas: notasInput || null }).eq('id', historico.id)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, notas: notasInput || null } : a))
    setHistorico(h => h ? { ...h, notas: notasInput || null } : h)
    setSalvandoNotas(false)
  }

  async function salvarResponsavel() {
    if (!historico) return
    await supabase.from('atendimentos_whatsapp').update({ responsavel: responsavelInput || null }).eq('id', historico.id)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, responsavel: responsavelInput || null } : a))
    setHistorico(h => h ? { ...h, responsavel: responsavelInput || null } : h)
  }

  async function salvarTelefone() {
    if (!historico || !telefoneInput.trim()) return; setSalvandoTelefone(true)
    const tel = telefoneInput.trim().replace(/\D/g, '')
    await supabase.from('atendimentos_whatsapp').update({ telefone: tel }).eq('id', historico.id)
    setHistorico(h => h ? { ...h, telefone: tel } : h)
    setAtendimentos(prev => prev.map(a => a.id === historico.id ? { ...a, telefone: tel } : a))
    setTelefoneInput(''); setSalvandoTelefone(false)
  }

  async function salvarAgendamento() {
    if (!historico || !agendarInput.mensagem.trim() || !agendarInput.enviar_em) return
    setSalvandoAgendar(true)
    await supabase.from('mensagens_agendadas').insert({ atendimento_id: historico.id, mensagem: agendarInput.mensagem.trim(), enviar_em: new Date(agendarInput.enviar_em).toISOString() })
    setAgendarInput({ mensagem: '', enviar_em: '' }); setModalAgendar(false)
    carregarAgendamentos(historico.id); setSalvandoAgendar(false)
  }

  async function excluirAgendamento(id: string) {
    await supabase.from('mensagens_agendadas').delete().eq('id', id)
    setAgendamentos(prev => prev.filter(a => a.id !== id))
  }

  async function salvarResposta() {
    if (!formResposta.titulo.trim() || !formResposta.mensagem.trim()) return
    if (editandoResposta) await supabase.from('respostas_rapidas').update({ titulo: formResposta.titulo.trim(), mensagem: formResposta.mensagem.trim() }).eq('id', editandoResposta)
    else await supabase.from('respostas_rapidas').insert({ titulo: formResposta.titulo.trim(), mensagem: formResposta.mensagem.trim() })
    setFormResposta({ titulo: '', mensagem: '' }); setEditandoResposta(null); carregarRespostas()
  }

  async function excluirResposta(id: string) {
    if (!confirm('Excluir?')) return
    await supabase.from('respostas_rapidas').delete().eq('id', id); carregarRespostas()
  }

  // ── Filtros ──
  const lembreteVencidos = atendimentos.filter(a => a.lembrete && new Date(a.lembrete) <= new Date() && a.coluna !== (colunas.at(-1)?.chave ?? 'finalizado'))
  const naoLidosTotal = atendimentos.filter(a => a.nao_lido).length

  const lista = atendimentos.filter(a => {
    if (filtroColuna && a.coluna !== filtroColuna) return false
    if (busca) {
      const q = busca.toLowerCase()
      return a.nome.toLowerCase().includes(q) || (a.telefone ?? '').includes(q) || (a.ultima_mensagem ?? '').toLowerCase().includes(q) || (a.assunto ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const colAtual = colunas.find(c => c.chave === historico?.coluna)
  const corAtual = CORES[colAtual?.cor ?? 'slate'] ?? CORES.slate

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex -m-8 bg-white overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ══ LEFT: Lista de conversas ══════════════════════════════════════════ */}
      <div className="w-80 flex flex-col border-r border-slate-200 bg-white flex-shrink-0">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-green-600" />
              </div>
              <span className="font-bold text-slate-800">WhatsApp CRM</span>
              {naoLidosTotal > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{naoLidosTotal}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={buscarStatusEvo} disabled={loadingQR} title="Conectar WhatsApp"
                className={`p-1.5 rounded-lg transition-colors ${evoConectado && evoStatus ? 'text-green-600 bg-green-50' : 'text-slate-500 hover:bg-slate-100'}`}>
                {evoConectado && evoStatus ? <Wifi className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
              </button>
              <button onClick={carregar} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setModalNovo(true)}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" />Novo
              </button>
            </div>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full pl-8 pr-3 py-2 bg-slate-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors" />
          </div>
        </div>

        {/* Tabs de status */}
        <div className="flex overflow-x-auto border-b border-slate-100 px-2 pt-1 gap-0.5 scrollbar-hide flex-shrink-0">
          <button onClick={() => setFiltroColuna(null)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${!filtroColuna ? 'border-green-500 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Todos <span className="ml-1 text-xs opacity-70">({atendimentos.length})</span>
          </button>
          {colunas.map(col => {
            const c = CORES[col.cor] ?? CORES.slate
            const count = atendimentos.filter(a => a.coluna === col.chave).length
            return (
              <button key={col.chave} onClick={() => setFiltroColuna(filtroColuna === col.chave ? null : col.chave)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${filtroColuna === col.chave ? `${c.tab} border-current` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {col.nome} <span className="ml-1 opacity-70">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Lembretes vencidos */}
        {lembreteVencidos.length > 0 && (
          <div className="mx-3 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2 flex-shrink-0">
            <Bell className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">{lembreteVencidos.length} lembrete{lembreteVencidos.length > 1 ? 's' : ''} vencido{lembreteVencidos.length > 1 ? 's' : ''}</p>
              {lembreteVencidos.slice(0, 2).map(a => (
                <button key={a.id} onClick={() => abrirConversa(a)} className="text-xs text-amber-700 hover:underline block truncate max-w-full">{a.nome}</button>
              ))}
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-400 text-sm">Carregando...</div>
          ) : lista.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              {busca ? 'Nenhuma conversa encontrada' : 'Nenhum atendimento ainda'}
            </div>
          ) : lista.map(a => {
            const col = colunas.find(c => c.chave === a.coluna)
            const cor = CORES[col?.cor ?? 'slate'] ?? CORES.slate
            const isAtivo = historico?.id === a.id
            return (
              <div key={a.id} onClick={() => abrirConversa(a)}
                className={`flex items-start gap-3 px-3 py-3 border-b border-slate-100 cursor-pointer border-l-4 transition-colors ${isAtivo ? 'bg-green-50 border-l-green-500' : `${a.nao_lido ? cor.bg : 'bg-white hover:bg-slate-50'} ${cor.border}`}`}>
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full ${getAvatarCor(a.nome)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                  {getInitials(a.nome)}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {a.nao_lido && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />}
                      <p className={`text-sm truncate ${a.nao_lido ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{a.nome}</p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {a.ultimo_contato ? horaRelativa(a.ultimo_contato) : horaRelativa(a.created_at)}
                    </span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${a.nao_lido ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {a.ultima_mensagem || a.assunto || 'Sem mensagens'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cor.badge}`}>{col?.nome ?? a.coluna}</span>
                    {(a.tags || []).slice(0, 2).map(t => {
                      const ti = tagInfo(t)
                      return <span key={t} className={`text-xs px-1 py-0.5 rounded border font-medium ${ti.cor}`}>{ti.label}</span>
                    })}
                    {a.lembrete && new Date(a.lembrete) <= new Date() && <Bell className="w-3 h-3 text-amber-500" />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ══ RIGHT: Chat ════════════════════════════════════════════════════════ */}
      {historico ? (
        <div className="flex flex-1 min-w-0">

          {/* Chat area */}
          <div className="flex flex-col flex-1 min-w-0">

            {/* QR Code (colapsável) */}
            {showQR && (
              <div className="border-b border-slate-200 bg-white px-4 py-3 flex-shrink-0">
                {evoConectado ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700 text-sm">
                      <Wifi className="w-4 h-4" /><span className="font-medium">WhatsApp conectado — +55 21 96435-3290</span>
                    </div>
                    <button onClick={() => setShowQR(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                  </div>
                ) : qrBase64 ? (
                  <div className="flex items-start gap-4">
                    <img src={qrBase64} alt="QR" className="w-32 h-32 border border-slate-200 rounded" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-1">Escaneie para conectar o WhatsApp</p>
                      <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
                        <li>Abra o WhatsApp no celular</li>
                        <li>Configurações → Aparelhos Conectados</li>
                        <li>Conectar um aparelho</li>
                      </ol>
                    </div>
                    <button onClick={() => setShowQR(false)} className="ml-auto text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                  </div>
                ) : <p className="text-sm text-slate-500">Carregando QR Code...</p>}
              </div>
            )}

            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-3 flex-shrink-0">
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full ${getAvatarCor(historico.nome)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                {getInitials(historico.nome)}
              </div>
              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{historico.nome}</p>
                <div className="flex items-center gap-2">
                  {historico.telefone && (
                    <a href={telefoneLink(historico.telefone)} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline flex items-center gap-1">
                      <Phone className="w-3 h-3" />{formatarTelefone(historico.telefone)}
                    </a>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1">
                {/* Status badge + dropdown */}
                <div className="relative">
                  <button onClick={() => { setShowStatusMenu(!showStatusMenu); setShowMenu(false); setShowTagsMenu(false) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${corAtual.badge} transition-colors`}>
                    <span className={`w-2 h-2 rounded-full ${corAtual.dot}`} />
                    {colAtual?.nome ?? historico.coluna}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showStatusMenu && (
                    <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 w-48">
                      {colunas.map(col => {
                        const c = CORES[col.cor] ?? CORES.slate
                        return (
                          <button key={col.chave} onClick={() => mudarStatus(historico.id, col.chave)}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${historico.coluna === col.chave ? 'font-semibold' : ''}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                            {col.nome}
                            {historico.coluna === col.chave && <Check className="w-3.5 h-3.5 ml-auto text-green-600" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <button onClick={() => setShowInfo(!showInfo)}
                  className={`p-2 rounded-lg transition-colors ${showInfo ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-100'}`} title="Informações">
                  <Info className="w-4 h-4" />
                </button>

                {/* Menu */}
                <div className="relative">
                  <button onClick={() => { setShowMenu(!showMenu); setShowStatusMenu(false); setShowTagsMenu(false) }}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 w-44">
                      <button onClick={() => { toggleNaoLido(historico.id, !historico.nao_lido); setShowMenu(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                        <Circle className="w-3.5 h-3.5" />
                        {historico.nao_lido ? 'Marcar como lido' : 'Marcar como não lido'}
                      </button>
                      <button onClick={() => { setModalRespostas(true); setShowMenu(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-yellow-500" />Respostas rápidas
                      </button>
                      <hr className="my-1 border-slate-100" />
                      <button onClick={() => excluir(historico.id, historico.nome)}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" />Excluir conversa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={mensagensRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: '#f0f2f5' }}
              onClick={() => { setShowStatusMenu(false); setShowMenu(false); setShowTagsMenu(false) }}>
              {(!historico.mensagens || historico.mensagens.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Sem mensagens ainda</p>
                  {(historico.whatsapp_jid || historico.telefone) && (
                    <p className="text-xs mt-1 opacity-70">Envie a primeira mensagem abaixo</p>
                  )}
                </div>
              ) : (
                historico.mensagens.map((msg, i) => {
                  const isVoce = msg.de === 'Você'
                  return (
                    <div key={i} className={`flex ${isVoce ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-sm lg:max-w-md rounded-2xl px-4 py-2.5 shadow-sm ${isVoce ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm'}`}>
                        {!isVoce && historico.mensagens.filter(m => m.de !== 'Você').length > 0 && (
                          <p className="text-xs font-semibold text-green-600 mb-0.5">{msg.de}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.texto}</p>
                        <p className={`text-xs mt-1 ${isVoce ? 'text-green-100' : 'text-slate-400'} text-right`}>
                          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Reply area */}
            {(historico.whatsapp_jid || historico.telefone) ? (
              <div className="px-4 py-3 bg-white border-t border-slate-200 flex-shrink-0">
                {/* Sem telefone (@lid) */}
                {!historico.telefone && historico.whatsapp_jid && (
                  <div className="mb-2 flex items-center gap-2">
                    <input value={telefoneInput} onChange={e => setTelefoneInput(e.target.value)}
                      placeholder="Adicione o telefone para responder (5521...)"
                      className="flex-1 text-sm border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <button onClick={salvarTelefone} disabled={salvandoTelefone || !telefoneInput.trim()}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
                      {salvandoTelefone ? '...' : 'Salvar'}
                    </button>
                  </div>
                )}
                {erroEnvio && (
                  <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <p className="text-xs text-red-600">{erroEnvio}</p>
                    <button onClick={() => setErroEnvio(null)}><X className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                )}
                {/* Quick replies dropdown */}
                {showRespostas && respostas.length > 0 && (
                  <div className="mb-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {respostas.map(r => (
                      <button key={r.id} onClick={() => { setResposta(r.mensagem); setShowRespostas(false); respostaRef.current?.focus() }}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <p className="text-sm font-medium text-slate-700">{r.titulo}</p>
                        <p className="text-xs text-slate-500 truncate">{r.mensagem}</p>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button onClick={() => setShowRespostas(!showRespostas)} title="Respostas rápidas"
                    className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${showRespostas ? 'bg-yellow-100 text-yellow-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                    <Zap className="w-4 h-4" />
                  </button>
                  <button onClick={() => setModalAgendar(true)} title="Agendar mensagem"
                    className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </button>
                  <textarea
                    ref={respostaRef}
                    value={resposta}
                    onChange={e => setResposta(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarResposta() } }}
                    placeholder="Digite uma mensagem... (Enter para enviar)"
                    rows={1}
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none overflow-y-auto"
                    onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }}
                  />
                  <button onClick={enviarResposta} disabled={enviando || !resposta.trim()}
                    className="bg-green-500 hover:bg-green-600 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 bg-white border-t border-slate-200 text-center text-sm text-slate-400">
                Adicione um telefone no painel de informações para poder responder
              </div>
            )}
          </div>

          {/* ── Info sidebar ── */}
          {showInfo && (
            <div className="w-72 flex-shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Contact info */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contato</p>
                  {!historico.telefone ? (
                    <div className="flex gap-1">
                      <input value={telefoneInput} onChange={e => setTelefoneInput(e.target.value)}
                        placeholder="Adicionar telefone"
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500" />
                      <button onClick={salvarTelefone} disabled={salvandoTelefone || !telefoneInput.trim()}
                        className="bg-green-600 text-white px-2 py-1.5 rounded-lg text-xs disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <a href={telefoneLink(historico.telefone)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-600 hover:underline font-medium">
                      <Phone className="w-4 h-4" />{formatarTelefone(historico.telefone)}
                    </a>
                  )}
                  {historico.assunto && <p className="text-xs text-slate-500 mt-1">{historico.assunto}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Início: {new Date(historico.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <hr className="border-slate-100" />

                {/* Tags */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Etiquetas</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(historico.tags || []).map(t => {
                      const ti = tagInfo(t)
                      return (
                        <span key={t} className={`text-xs px-2 py-1 rounded-lg border font-medium ${ti.cor} flex items-center gap-1`}>
                          {ti.label}
                          <button onClick={() => toggleTag(t)} className="opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                        </span>
                      )
                    })}
                  </div>
                  <div className="relative">
                    <button onClick={() => setShowTagsMenu(!showTagsMenu)}
                      className="text-xs text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded-lg px-2 py-1 flex items-center gap-1 transition-colors">
                      <Tag className="w-3 h-3" />+ Adicionar etiqueta
                    </button>
                    {showTagsMenu && (
                      <div className="absolute left-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-2 w-44">
                        {TAGS_DISPONIVEIS.map(t => (
                          <button key={t.id} onClick={() => toggleTag(t.id)}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded-lg flex items-center gap-2 mb-0.5 ${historico.tags?.includes(t.id) ? t.cor + ' border' : 'hover:bg-slate-50 text-slate-600'}`}>
                            {historico.tags?.includes(t.id) && <Check className="w-3 h-3 flex-shrink-0" />}
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Responsável */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Responsável</p>
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input value={responsavelInput} onChange={e => setResponsavelInput(e.target.value)}
                      onBlur={salvarResponsavel}
                      onKeyDown={e => e.key === 'Enter' && salvarResponsavel()}
                      placeholder="Atribuir a..."
                      className="flex-1 text-sm border-0 border-b border-slate-200 focus:outline-none focus:border-green-500 py-1 bg-transparent" />
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Lembrete */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lembrete</p>
                  <div className="flex items-center gap-1">
                    <input type="datetime-local" value={lembreteInput} onChange={e => setLembreteInput(e.target.value)}
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    <button onClick={salvarLembrete} disabled={salvandoLembrete}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-1.5 rounded-lg transition-colors">
                      {salvandoLembrete ? '...' : <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {historico.lembrete && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${new Date(historico.lembrete) <= new Date() ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
                      <Bell className="w-3 h-3" />
                      {new Date(historico.lembrete).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                <hr className="border-slate-100" />

                {/* Notas */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notas internas</p>
                  <textarea value={notasInput} onChange={e => setNotasInput(e.target.value)}
                    onBlur={salvarNotas}
                    placeholder="Anotações visíveis só para a equipe..."
                    rows={3}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  {salvandoNotas && <p className="text-xs text-slate-400">Salvando...</p>}
                </div>

                {/* Agendamentos */}
                {agendamentos.length > 0 && (
                  <>
                    <hr className="border-slate-100" />
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mensagens agendadas</p>
                      {agendamentos.map(ag => (
                        <div key={ag.id} className="flex items-start gap-2 mb-2 bg-blue-50 rounded-lg p-2">
                          <AlarmClock className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 truncate">{ag.mensagem}</p>
                            <p className="text-xs text-blue-500">{new Date(ag.enviar_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <button onClick={() => excluirAgendamento(ag.id)} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 gap-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-slate-700">WhatsApp CRM</p>
            <p className="text-slate-500 text-sm mt-1">Selecione uma conversa para começar</p>
          </div>
          <button onClick={() => setModalNovo(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors mt-2">
            <Plus className="w-4 h-4" />Novo atendimento
          </button>
          {!evoStatus && (
            <button onClick={buscarStatusEvo} disabled={loadingQR}
              className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-white px-4 py-2 rounded-xl text-sm transition-colors">
              <QrCode className="w-4 h-4" />{loadingQR ? 'Conectando...' : 'Conectar WhatsApp'}
            </button>
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
                  placeholder="Nome do cliente" autoFocus
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefone / WhatsApp</label>
                <input type="text" value={formNovo.telefone} onChange={e => setFormNovo(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(21) 99999-9999"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assunto</label>
                <textarea value={formNovo.assunto} onChange={e => setFormNovo(f => ({ ...f, assunto: e.target.value }))}
                  rows={3} placeholder="Descreva o assunto..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setModalNovo(false); setFormNovo({ nome: '', telefone: '', assunto: '' }) }}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-xl text-sm transition-colors">Cancelar</button>
              <button onClick={salvarNovo} disabled={salvandoNovo || !formNovo.nome.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />Agendar Mensagem
              </h2>
              <button onClick={() => setModalAgendar(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Para: <strong>{historico.nome}</strong></p>
            <div className="space-y-3">
              <textarea value={agendarInput.mensagem} onChange={e => setAgendarInput(f => ({ ...f, mensagem: e.target.value }))}
                rows={4} placeholder="Mensagem que será enviada automaticamente..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <input type="datetime-local" value={agendarInput.enviar_em} onChange={e => setAgendarInput(f => ({ ...f, enviar_em: e.target.value }))}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-slate-400">⚠️ O envio ocorre automaticamente quando você abrir o sistema após o horário agendado.</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalAgendar(false)}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={salvarAgendamento} disabled={salvandoAgendar || !agendarInput.mensagem.trim() || !agendarInput.enviar_em}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
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
                placeholder="Título" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              <textarea value={formResposta.mensagem} onChange={e => setFormResposta(f => ({ ...f, mensagem: e.target.value }))}
                placeholder="Mensagem..." rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
              <div className="flex gap-2">
                {editandoResposta && (
                  <button onClick={() => { setEditandoResposta(null); setFormResposta({ titulo: '', mensagem: '' }) }}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-xl text-sm">Cancelar</button>
                )}
                <button onClick={salvarResposta} disabled={!formResposta.titulo.trim() || !formResposta.mensagem.trim()}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-1.5 rounded-xl text-sm font-medium disabled:opacity-50">
                  {editandoResposta ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {respostas.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Nenhuma resposta cadastrada</p>
              ) : respostas.map(r => (
                <div key={r.id} className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{r.titulo}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{r.mensagem}</p>
                  </div>
                  <div className="flex gap-1">
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
    </div>
  )
}
