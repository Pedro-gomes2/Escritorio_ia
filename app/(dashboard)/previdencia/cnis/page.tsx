'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle, TrendingUp,
  Calendar, Clock, DollarSign, User, ChevronDown, ChevronUp,
  Info, Award, ArrowRight, BarChart3, X, Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ResultadoBeneficio, ResultadoTransicao } from '@/lib/previdencia/calculos'

// ─── Tipos locais ─────────────────────────────────────────────────────────────
interface DadosImportados {
  nomeSegurado: string
  cpf: string
  dataNascimento: string | null
  sexo: 'M' | 'F' | null
  totalCompetencias: number
  totalVinculos: number
  competencias: Array<{ competencia: string; ano: number; mes: number; remuneracao: number; carencia: boolean }>
  erros: string[]
}

interface RespostaAPI {
  ok: boolean
  extratoId: string | null
  dados: DadosImportados
  resultado: ResultadoBeneficio | null
  error?: string
}

interface ClienteItem {
  id: string
  nome: string
  cpf_cnpj: string | null
}

interface ExtratoAnterior {
  sexo: string | null
  data_nascimento: string | null
  total_competencias: number
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(d: Date | string | null): string {
  if (!d) return '-'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('pt-BR')
}

const COR_REGRA: Record<string, string> = {
  'Regra de Pontos': 'blue',
  'Pedágio 50%': 'purple',
  'Pedágio 100%': 'orange',
  'Idade Progressiva': 'teal',
  'Regra Definitiva': 'green',
}

function BadgeRegra({ regra, elegivel }: { regra: string; elegivel: boolean }) {
  const cor = COR_REGRA[regra] ?? 'slate'
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    teal: 'bg-teal-100 text-teal-700 border-teal-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[cor]} ${elegivel ? '' : 'opacity-60'}`}>
      {regra}
    </span>
  )
}

// ─── Componente interno (usa useSearchParams) ─────────────────────────────────
function CNISPage() {
  const searchParams = useSearchParams()
  const clienteIdParam = searchParams.get('clienteId')
  const supabase = createClient()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [clienteId, setClienteId] = useState(clienteIdParam ?? '')
  const [clientes, setClientes] = useState<ClienteItem[]>([])
  const [extratoAnterior, setExtratoAnterior] = useState<ExtratoAnterior | null>(null)
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('')
  const [dataNasc, setDataNasc] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<RespostaAPI | null>(null)
  const [erroUpload, setErroUpload] = useState<string | null>(null)
  const [showCompetencias, setShowCompetencias] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Carrega lista de clientes ao montar
  useEffect(() => {
    async function carregarClientes() {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cpf_cnpj')
        .order('nome')
      setClientes(data ?? [])
    }
    carregarClientes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Quando clienteId muda, busca extrato anterior
  useEffect(() => {
    if (!clienteId) { setExtratoAnterior(null); return }
    async function buscarExtrato() {
      const { data } = await supabase
        .from('cnis_extratos')
        .select('sexo, data_nascimento, total_competencias, created_at')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setExtratoAnterior(data ?? null)
      if (data?.sexo && !sexo) setSexo(data.sexo as 'M' | 'F')
      if (data?.data_nascimento && !dataNasc) setDataNasc(data.data_nascimento)
    }
    buscarExtrato()
  }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function importar() {
    if (!arquivo) return
    setCarregando(true); setErroUpload(null); setResultado(null)

    const fd = new FormData()
    fd.append('arquivo', arquivo)
    if (clienteId) fd.append('clienteId', clienteId)
    if (sexo) fd.append('sexo', sexo)
    if (dataNasc) fd.append('dataNascimento', dataNasc)

    try {
      const res = await fetch('/api/previdencia/importar', { method: 'POST', body: fd })
      const data: RespostaAPI = await res.json()
      if (!res.ok || data.error) {
        setErroUpload(data.error ?? `Erro ${res.status}`)
      } else {
        setResultado(data)
        if (data.dados?.sexo && !sexo) setSexo(data.dados.sexo)
        if (data.dados?.dataNascimento && !dataNasc) {
          setDataNasc(data.dados.dataNascimento.split('T')[0])
        }
      }
    } catch {
      setErroUpload('Erro de conexão ao processar arquivo')
    } finally {
      setCarregando(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.pdf') || f.name.endsWith('.xml'))) setArquivo(f)
  }

  const r = resultado?.resultado
  const d = resultado?.dados

  // Nome do cliente selecionado para exibição
  const clienteSelecionado = clientes.find(c => c.id === clienteId)

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Análise de CNIS</h1>
          <p className="text-xs text-slate-500">Importe o extrato e calcule aposentadoria + salário de benefício</p>
        </div>
        <Link href="/previdencia" className="ml-auto text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
          ← Calculadoras
        </Link>
      </div>

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-5">

        {/* Upload */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-500" />Importar Extrato CNIS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Seletor de cliente */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                <Users className="w-3 h-3 inline mr-1" />Cliente (opcional)
              </label>
              <select
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Análise avulsa —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ''}
                  </option>
                ))}
              </select>
              {extratoAnterior && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Extrato anterior: {new Date(extratoAnterior.created_at).toLocaleDateString('pt-BR')}
                  {' '}({extratoAnterior.total_competencias} competências)
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sexo *</label>
              <select
                value={sexo}
                onChange={e => setSexo(e.target.value as 'M' | 'F' | '')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data de Nascimento *</label>
              <input
                type="date"
                value={dataNasc}
                onChange={e => setDataNasc(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-400 bg-blue-50' : arquivo ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
          >
            <input ref={inputRef} type="file" accept=".pdf,.xml" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setArquivo(f) }} />
            {arquivo ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-green-500" />
                <div className="text-left">
                  <p className="font-medium text-green-700">{arquivo.name}</p>
                  <p className="text-xs text-green-600">{(arquivo.size / 1024).toFixed(0)} KB — clique para trocar</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setArquivo(null) }} className="text-slate-400 hover:text-red-500 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-slate-400 text-sm mt-1">PDF (extrato impresso) ou XML (Meu INSS / Gov.br)</p>
                <p className="text-xs text-slate-400 mt-2">
                  💡 Dica: XML do Meu INSS tem melhor precisão que PDF
                </p>
              </>
            )}
          </div>

          {erroUpload && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{erroUpload}</p>
            </div>
          )}

          {d?.erros && d.erros.length > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {d.erros.map((e, i) => (
                <p key={i} className="text-xs text-amber-700 flex items-center gap-1"><Info className="w-3 h-3" />{e}</p>
              ))}
            </div>
          )}

          <button
            onClick={importar}
            disabled={!arquivo || carregando || !sexo || !dataNasc}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {carregando
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
              : <><BarChart3 className="w-4 h-4" />{clienteId ? `Importar e Salvar para ${clienteSelecionado?.nome ?? 'cliente'}` : 'Importar e Calcular'}</>
            }
          </button>

          {/* Link de retorno ao cliente após salvar */}
          {resultado?.extratoId && clienteId && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Extrato salvo com sucesso!
              </p>
              <Link href={`/clientes/${clienteId}`} className="text-sm text-green-700 font-medium hover:underline">
                ← Ver perfil do cliente
              </Link>
            </div>
          )}
        </div>

        {/* Resultados */}
        {resultado && d && (
          <>
            {/* Cabeçalho do segurado */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{d.nomeSegurado || clienteSelecionado?.nome || 'Segurado'}</h2>
                    <p className="text-sm text-slate-500">
                      {d.cpf ? `CPF: ${d.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}` : ''}
                      {d.dataNascimento ? ` · Nascimento: ${formatDate(d.dataNascimento)}` : ''}
                      {d.sexo ? ` · ${d.sexo === 'M' ? 'Masculino' : 'Feminino'}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{d.totalCompetencias}</p>
                    <p className="text-xs text-slate-500">Competências</p>
                  </div>
                  {r && <>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-800">{r.tempoContribuicaoAnos}a {r.tempoContribuicaoMeses}m</p>
                      <p className="text-xs text-slate-500">Tempo de Contribuição</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-800">{r.idadeAtual}a {r.idadeAtualMeses}m</p>
                      <p className="text-xs text-slate-500">Idade Atual</p>
                    </div>
                  </>}
                </div>
              </div>
            </div>

            {r && (
              <>
                {/* Salário de Benefício */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />Salário de Benefício
                    </h3>
                    <div className="space-y-3">
                      <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs text-green-600 font-medium mb-1">Pós-Reforma (EC 103/2019) — Média 100%</p>
                        <p className="text-2xl font-bold text-green-700">{moeda(r.salarioBeneficio.mediaTotal)}</p>
                        <p className="text-xs text-green-600 mt-1">{r.salarioBeneficio.totalCompetencias} competências · {r.salarioBeneficio.periodoApuracao}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs text-blue-600 font-medium mb-1">Pré-Reforma — Melhores 80%</p>
                        <p className="text-2xl font-bold text-blue-700">{moeda(r.salarioBeneficio.mediaMelhores80)}</p>
                        <p className="text-xs text-blue-600 mt-1">{r.salarioBeneficio.competenciasUsadas80} de {r.salarioBeneficio.totalCompetencias} competências utilizadas</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <Award className="w-4 h-4 text-purple-500" />Estimativa do Benefício
                    </h3>
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 mb-3">
                      <p className="text-xs text-purple-600 font-medium mb-1">Coeficiente atual</p>
                      <p className="text-3xl font-bold text-purple-700">{(r.coeficiente * 100).toFixed(0)}%</p>
                      <p className="text-xs text-slate-500 mt-1">Sobre o salário de benefício</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-1">Benefício estimado (pós-reforma)</p>
                      <p className="text-2xl font-bold text-slate-800">{moeda(r.beneficioEstimado)}</p>
                      <p className="text-xs text-slate-400 mt-1">Teto RGPS 2024: {moeda(r.teto)}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 flex items-start gap-1">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      Estimativa indicativa. O coeficiente aumenta 2% por ano acima do mínimo (máx. 100%).
                    </p>
                  </div>
                </div>

                {/* Melhor regra em destaque */}
                {r.melhorRegra && (
                  <div className={`rounded-xl border-2 p-5 ${r.melhorRegra.elegivel ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
                    <div className="flex items-start gap-3">
                      {r.melhorRegra.elegivel
                        ? <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                        : <Clock className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className={`font-bold text-base ${r.melhorRegra.elegivel ? 'text-green-800' : 'text-amber-800'}`}>
                            {r.melhorRegra.elegivel ? '✅ Pode aposentar pela:' : '⏳ Mais próxima:'}
                          </h3>
                          <BadgeRegra regra={r.melhorRegra.regra} elegivel={r.melhorRegra.elegivel} />
                        </div>
                        <p className={`text-sm ${r.melhorRegra.elegivel ? 'text-green-700' : 'text-amber-700'}`}>
                          {r.melhorRegra.descricao}
                        </p>
                        <p className={`text-xs mt-1 ${r.melhorRegra.elegivel ? 'text-green-600' : 'text-amber-600'}`}>
                          {r.melhorRegra.detalhe}
                        </p>
                        {!r.melhorRegra.elegivel && r.melhorRegra.dataElegibilidade && (
                          <p className="text-sm font-semibold text-amber-800 mt-2 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Elegível em: {formatDate(r.melhorRegra.dataElegibilidade)}
                            <span className="text-xs font-normal ml-1">
                              ({Math.floor(r.melhorRegra.mesesRestantes / 12)} anos e {r.melhorRegra.mesesRestantes % 12} meses)
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Todas as regras */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />Todas as Regras de Transição
                  </h3>
                  <div className="space-y-3">
                    {r.transicoes.map((t, i) => (
                      <RegraCard key={i} regra={t} />
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 flex items-start gap-1">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      As regras de transição valem apenas para quem já contribuía antes de 13/11/2019.
                      Contribuições após essa data seguem a regra definitiva.
                    </p>
                  </div>
                </div>

                {/* Competências */}
                <div className="bg-white rounded-xl border border-slate-200">
                  <button onClick={() => setShowCompetencias(!showCompetencias)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors rounded-xl">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      Histórico de Competências ({d.totalCompetencias} registros)
                    </h3>
                    {showCompetencias ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {showCompetencias && (
                    <div className="px-5 pb-5">
                      <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Competência</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Remuneração</th>
                              <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">Carência</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {d.competencias.map((c, i) => (
                              <tr key={i} className={`${!c.carencia ? 'bg-red-50' : i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                                <td className="px-3 py-2 font-mono text-slate-700">{c.competencia}</td>
                                <td className="px-3 py-2 text-right font-medium text-slate-800">
                                  {c.remuneracao > 0 ? moeda(c.remuneracao) : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {c.carencia
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                                    : <X className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Sem dados suficientes para calcular */}
            {!r && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Dados insuficientes para calcular</p>
                  <p className="text-sm text-amber-700 mt-1">Preencha sexo e data de nascimento corretamente para obter a simulação completa.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Info inicial */}
        {!resultado && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Upload, titulo: '1. Importe o CNIS', desc: 'PDF do extrato impresso ou XML baixado no Meu INSS / Gov.br', cor: 'blue' },
              { icon: BarChart3, titulo: '2. Cálculo automático', desc: 'Sistema identifica competências, calcula salário de benefício e simula todas as regras de transição', cor: 'purple' },
              { icon: Award, titulo: '3. Melhor estratégia', desc: 'Veja qual regra dá a aposentadoria mais cedo e o maior benefício', cor: 'green' },
            ].map(({ icon: Icon, titulo, desc, cor }) => (
              <div key={titulo} className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                <div className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-${cor}-100`}>
                  <Icon className={`w-5 h-5 text-${cor}-600`} />
                </div>
                <h3 className="font-semibold text-slate-700 mb-1">{titulo}</h3>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Export default com Suspense (obrigatório para useSearchParams no App Router) ─
export default function CNISPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />Carregando...
      </div>
    }>
      <CNISPage />
    </Suspense>
  )
}

// ─── Card de regra ─────────────────────────────────────────────────────────────
function RegraCard({ regra }: { regra: ResultadoTransicao }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-xl border ${regra.elegivel ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {regra.elegivel
          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          : <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <BadgeRegra regra={regra.regra} elegivel={regra.elegivel} />
            <span className="text-xs text-slate-500">{regra.descricao}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {regra.elegivel
            ? <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Elegível</span>
            : regra.dataElegibilidade
              ? <span className="text-xs text-slate-600 font-medium">{formatDate(regra.dataElegibilidade)}</span>
              : <span className="text-xs text-red-400">Indisponível</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 border-t border-slate-100">
          <p className="text-xs text-slate-600 mb-1">{regra.detalhe}</p>
          {!regra.elegivel && regra.mesesRestantes > 0 && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              Faltam <strong>{Math.floor(regra.mesesRestantes / 12)} anos e {regra.mesesRestantes % 12} meses</strong>
            </p>
          )}
          {regra.pontos !== undefined && (
            <p className="text-xs text-slate-500 mt-1">Pontuação atual: <strong>{regra.pontos}</strong></p>
          )}
        </div>
      )}
    </div>
  )
}
