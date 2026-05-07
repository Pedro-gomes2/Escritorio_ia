'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bot, Send, Upload, FileText, Plus, Loader2,
  MessageSquare, X, ChevronDown, AlertCircle, Trash2,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Mensagem = { role: 'user' | 'assistant'; content: string; timestamp: string }
type Conversa = { id: string; titulo: string; documento_id: string | null; created_at: string }
type Documento = { id: string; nome: string; created_at: string }

type Props = {
  userId: string
  conversasIniciais: Conversa[]
  documentosDisponiveis: Documento[]
}

export default function AssistenteChat({ userId, conversasIniciais, documentosDisponiveis }: Props) {
  const supabase = createClient()
  const [conversas, setConversas] = useState(conversasIniciais)
  const [documentos, setDocumentos] = useState(documentosDisponiveis)
  const [conversaAtual, setConversaAtual] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [docSelecionado, setDocSelecionado] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [resposta, setResposta] = useState('')
  const [erro, setErro] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, resposta])

  // Retorna o ID da conversa criada — resolve a race condition
  async function criarConversa(): Promise<string | null> {
    const { data } = await supabase.from('conversas_ia').insert({
      usuario_id: userId,
      titulo: 'Nova conversa',
      mensagens: [],
    }).select().single()

    if (data) {
      setConversas(prev => [data, ...prev])
      setConversaAtual(data.id)
      setMensagens([])
      setDocSelecionado(null)
      return data.id
    }
    return null
  }

  async function novaConversa() {
    await criarConversa()
  }

  async function excluirConversa(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Excluir esta conversa?')) return
    await supabase.from('conversas_ia').delete().eq('id', id)
    setConversas(prev => prev.filter(c => c.id !== id))
    if (conversaAtual === id) {
      setConversaAtual(null)
      setMensagens([])
    }
  }

  async function abrirConversa(id: string) {
    const { data } = await supabase.from('conversas_ia').select('*').eq('id', id).single()
    if (data) {
      setConversaAtual(id)
      setMensagens(data.mensagens ?? [])
      setDocSelecionado(data.documento_id)
      setErro('')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const json = await res.json()

    if (json.documento) {
      setDocumentos(prev => [json.documento, ...prev])
      setDocSelecionado(json.documento.id)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function enviarMensagem() {
    if (!input.trim() || enviando) return
    setErro('')

    // Garante que há uma conversa — captura o ID diretamente (sem depender do state)
    let conversaId = conversaAtual
    if (!conversaId) {
      conversaId = await criarConversa()
      if (!conversaId) {
        setErro('Erro ao criar conversa. Verifique a conexão com o Supabase.')
        return
      }
    }

    const novaMensagem: Mensagem = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    const novasMensagens = [...mensagens, novaMensagem]
    setMensagens(novasMensagens)
    const textoEnviado = input.trim()
    setInput('')
    setEnviando(true)
    setResposta('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: novasMensagens,
          documentoId: docSelecionado,
          conversaId,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Erro ${res.status}`)
      }

      if (!res.body) throw new Error('Resposta vazia da API')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let textoCompleto = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        textoCompleto += decoder.decode(value, { stream: true })
        setResposta(textoCompleto)
      }

      if (!textoCompleto) throw new Error('A IA não retornou nenhuma resposta.')

      const msgAssistente: Mensagem = {
        role: 'assistant',
        content: textoCompleto,
        timestamp: new Date().toISOString(),
      }
      setMensagens(prev => [...prev, msgAssistente])
      setResposta('')

      // Atualiza título da conversa na primeira mensagem
      if (novasMensagens.length === 1) {
        const titulo = textoEnviado.slice(0, 50)
        await supabase.from('conversas_ia').update({ titulo }).eq('id', conversaId)
        setConversas(prev => prev.map(c => c.id === conversaId ? { ...c, titulo } : c))
      }

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      setErro(`Falha ao enviar: ${msg}`)
      // Remove a mensagem do usuário se não houve resposta
      setMensagens(prev => prev.slice(0, -1))
      setInput(textoEnviado)
    } finally {
      setEnviando(false)
      setResposta('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensagem()
    }
  }

  const docAtual = docSelecionado ? documentos.find(d => d.id === docSelecionado) : null

  return (
    <div className="flex h-full">
      {/* Sidebar de conversas */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100">
          <button onClick={novaConversa}
            className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Nova conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversas.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Nenhuma conversa ainda</p>
          ) : (
            conversas.map(c => (
              <div key={c.id}
                className={`group flex items-center gap-1 rounded-lg mb-0.5 pr-1 transition-colors ${
                  conversaAtual === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}>
                <button onClick={() => abrirConversa(c.id)}
                  className={`flex-1 text-left px-3 py-2.5 min-w-0 ${
                    conversaAtual === c.id ? 'text-blue-700' : 'text-slate-700'
                  }`}>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-sm truncate">{c.titulo}</span>
                  </div>
                  <span className="text-xs text-slate-400 ml-5">{formatDate(c.created_at)}</span>
                </button>
                <button
                  onClick={e => excluirConversa(e, c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                  title="Excluir conversa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))

          )}
        </div>
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-800 text-sm">JurisIA — Assistente Jurídica</h2>
            <p className="text-xs text-slate-400">Especializada em direito brasileiro</p>
          </div>

          <div className="flex items-center gap-2">
            {docAtual ? (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                <FileText className="w-3.5 h-3.5" />
                <span className="max-w-32 truncate">{docAtual.nome}</span>
                <button onClick={() => setDocSelecionado(null)}>
                  <X className="w-3 h-3 hover:text-blue-900" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={docSelecionado ?? ''}
                  onChange={e => setDocSelecionado(e.target.value || null)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-6 appearance-none cursor-pointer text-slate-600"
                >
                  <option value="">Sem documento</option>
                  {documentos.map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            )}

            <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".pdf,.txt,.doc,.docx" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Enviando...' : 'Upload PDF'}
            </button>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {mensagens.length === 0 && !enviando && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-2">Como posso ajudar?</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Faça upload de um documento jurídico e me pergunte sobre ele, ou tire dúvidas sobre direito brasileiro.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-6 max-w-lg">
                {[
                  'Analise este contrato e identifique cláusulas problemáticas',
                  'Quais são os prazos processuais para recurso de apelação?',
                  'Resuma os pontos principais deste documento',
                  'Quais são meus direitos nesta situação trabalhista?',
                ].map(s => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-left text-xs text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-xl p-3 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
              }`}>
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
            </div>
          ))}

          {resposta && (
            <div className="flex justify-start">
              <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                <pre className="whitespace-pre-wrap font-sans">{resposta}</pre>
                <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
              </div>
            </div>
          )}

          {enviando && !resposta && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Analisando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Erro */}
        {erro && (
          <div className="mx-4 mb-2 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {erro}
            <button onClick={() => setErro('')} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-slate-200 p-4 flex-shrink-0">
          {docAtual && (
            <div className="flex items-center gap-2 text-xs text-blue-600 mb-2">
              <FileText className="w-3.5 h-3.5" />
              Contexto: {docAtual.nome}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta jurídica... (Enter para enviar, Shift+Enter para nova linha)"
              rows={2}
              className="flex-1 resize-none border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
            />
            <button
              onClick={enviarMensagem}
              disabled={!input.trim() || enviando}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
