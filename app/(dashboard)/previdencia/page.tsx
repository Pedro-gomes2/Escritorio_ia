'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calculator, User, TrendingUp, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, BarChart3, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Tabelas INSS 2024 (progressiva)
const INSS_FAIXAS = [
  { ate: 1412.00, aliquota: 0.075 },
  { ate: 2666.68, aliquota: 0.09 },
  { ate: 4000.03, aliquota: 0.12 },
  { ate: 7786.02, aliquota: 0.14 },
]
const TETO_INSS = 7786.02

// Tabela IRRF 2024
const IRRF_FAIXAS = [
  { ate: 2259.20, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { ate: Infinity, aliquota: 0.275, deducao: 896.00 },
]

function calcularINSS(bruto: number): number {
  let inss = 0
  let base = Math.min(bruto, TETO_INSS)
  let limite_anterior = 0
  for (const faixa of INSS_FAIXAS) {
    const valor_faixa = Math.min(base, faixa.ate - limite_anterior)
    if (valor_faixa <= 0) break
    inss += valor_faixa * faixa.aliquota
    limite_anterior = faixa.ate
    if (bruto <= faixa.ate) break
  }
  return inss
}

function calcularIRRF(base: number): number {
  if (base <= 0) return 0
  for (const f of IRRF_FAIXAS) {
    if (base <= f.ate) return Math.max(0, base * f.aliquota - f.deducao)
  }
  return 0
}

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function anos(meses: number) {
  const a = Math.floor(meses / 12)
  const m = meses % 12
  if (a === 0) return `${m} mês(es)`
  if (m === 0) return `${a} ano(s)`
  return `${a} ano(s) e ${m} mês(es)`
}

interface Plano {
  nomeCliente: string
  idadeAtual: number
  tempoContribuicaoMeses: number
  salarioBruto: number
  salarioLiquido: number
  inss: number
  idadeAposentadoria: number
  faltaIdadeMeses: number
  contribuicaoMinimaAnos: number
  faltaContribuicaoMeses: number
  podeAposentar: boolean
  faltaParaAposentar: number
  estimativaBeneficio: number
  sugestaoPrevidenciaPrivada: number
  rendaTotal: number
}

function calcularPlano(
  nome: string,
  nascimento: string,
  sexo: 'M' | 'F',
  salario: number,
  inicioContribuicao: string,
): Plano {
  const hoje = new Date()
  const dataNasc = new Date(nascimento)
  const dataInicio = new Date(inicioContribuicao)

  const idadeMeses = Math.floor((hoje.getTime() - dataNasc.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  const idadeAtual = Math.floor(idadeMeses / 12)
  const tempoContribuicaoMeses = Math.max(0, Math.floor((hoje.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))

  const idadeMinima = sexo === 'M' ? 65 : 62
  const contribuicaoMinima = sexo === 'M' ? 20 : 15

  const faltaIdadeMeses = Math.max(0, idadeMinima * 12 - idadeMeses)
  const faltaContribuicaoMeses = Math.max(0, contribuicaoMinima * 12 - tempoContribuicaoMeses)
  const faltaParaAposentar = Math.max(faltaIdadeMeses, faltaContribuicaoMeses)
  const podeAposentar = faltaParaAposentar === 0

  const salarioContribuicao = Math.min(salario, TETO_INSS)
  const anosContribuicao = Math.floor(tempoContribuicaoMeses / 12)
  const anosAposMinimo = Math.max(0, anosContribuicao - contribuicaoMinima)
  const percentual = Math.min(0.70 + anosAposMinimo * 0.01, 1.0)
  const estimativaBeneficio = salarioContribuicao * percentual

  const inss = calcularINSS(salario)
  const irrf = calcularIRRF(salario - inss)
  const salarioLiquido = salario - inss - irrf

  const sugestaoPrevidenciaPrivada = Math.max(0, salarioLiquido * 0.7 - estimativaBeneficio)
  const rendaTotal = estimativaBeneficio + sugestaoPrevidenciaPrivada

  return {
    nomeCliente: nome,
    idadeAtual,
    tempoContribuicaoMeses,
    salarioBruto: salario,
    salarioLiquido,
    inss,
    idadeAposentadoria: idadeMinima,
    faltaIdadeMeses,
    contribuicaoMinimaAnos: contribuicaoMinima,
    faltaContribuicaoMeses,
    podeAposentar,
    faltaParaAposentar,
    estimativaBeneficio,
    sugestaoPrevidenciaPrivada,
    rendaTotal,
  }
}

interface ClienteItem {
  id: string
  nome: string
}

// ─── Field fora do componente para não remontar a cada render ─────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function PrevidenciaPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<ClienteItem[]>([])
  const [clienteId, setClienteId] = useState('')

  const [form, setForm] = useState({
    nome: '',
    nascimento: '',
    sexo: 'M' as 'M' | 'F',
    salario: '',
    inicioContribuicao: '',
    tipoTrabalhador: 'clt',
  })
  const [plano, setPlano] = useState<Plano | null>(null)
  const [showCalc, setShowCalc] = useState(false)

  // Carrega lista de clientes
  useEffect(() => {
    supabase.from('clientes').select('id, nome').order('nome')
      .then(({ data }) => setClientes(data ?? []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ao selecionar cliente, preenche nome e tenta buscar dados do CNIS
  async function aoSelecionarCliente(id: string) {
    setClienteId(id)
    if (!id) return

    const cliente = clientes.find(c => c.id === id)
    if (cliente) {
      setForm(f => ({ ...f, nome: cliente.nome }))
    }

    // Busca extrato CNIS mais recente para pré-preencher nascimento e sexo
    const { data: extrato } = await supabase
      .from('cnis_extratos')
      .select('sexo, data_nascimento')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (extrato) {
      setForm(f => ({
        ...f,
        ...(extrato.sexo ? { sexo: extrato.sexo as 'M' | 'F' } : {}),
        ...(extrato.data_nascimento ? { nascimento: extrato.data_nascimento } : {}),
      }))
    }
  }

  function gerarPlano() {
    if (!form.nome || !form.nascimento || !form.salario || !form.inicioContribuicao) return
    const p = calcularPlano(
      form.nome,
      form.nascimento,
      form.sexo,
      parseFloat(form.salario),
      form.inicioContribuicao,
    )
    setPlano(p)
  }

  const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Calculator className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Plano Previdenciário</h1>
          <p className="text-slate-500 text-sm">Análise personalizada para o cliente</p>
        </div>
        <Link href="/previdencia/cnis"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <BarChart3 className="w-4 h-4" />Análise de CNIS
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Formulário */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-700">Dados do Cliente</h2>
            </div>
            <div className="space-y-3">

              {/* Seletor de cliente */}
              <Field label="Selecionar cliente cadastrado">
                <select
                  value={clienteId}
                  onChange={e => aoSelecionarCliente(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Preencher manualmente —</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </Field>

              <div className="border-t border-slate-100 pt-3" />

              <Field label="Nome do Cliente">
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo" className={inputClass} />
              </Field>
              <Field label="Data de Nascimento">
                <input type="date" value={form.nascimento} onChange={e => setForm(f => ({ ...f, nascimento: e.target.value }))}
                  className={inputClass} />
              </Field>
              <Field label="Sexo">
                <select value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value as 'M' | 'F' }))}
                  className={inputClass}>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </Field>
              <Field label="Tipo de Trabalhador">
                <select value={form.tipoTrabalhador} onChange={e => setForm(f => ({ ...f, tipoTrabalhador: e.target.value }))}
                  className={inputClass}>
                  <option value="clt">CLT (Empregado)</option>
                  <option value="autonomo">Autônomo / MEI</option>
                  <option value="servidor">Servidor Público</option>
                </select>
              </Field>
              <Field label="Salário Bruto Atual (R$)">
                <input type="number" value={form.salario} onChange={e => setForm(f => ({ ...f, salario: e.target.value }))}
                  placeholder="0,00" min="0" step="0.01" className={inputClass} />
              </Field>
              <Field label="Início das Contribuições ao INSS">
                <input type="date" value={form.inicioContribuicao} onChange={e => setForm(f => ({ ...f, inicioContribuicao: e.target.value }))}
                  className={inputClass} />
              </Field>

              <button
                onClick={gerarPlano}
                disabled={!form.nome || !form.nascimento || !form.salario || !form.inicioContribuicao}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 mt-2"
              >
                Gerar Plano Previdenciário
              </button>

              {clienteId && (
                <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" />
                  Dados pré-preenchidos do cadastro
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="col-span-2">
          {!plano ? (
            <div className="bg-white rounded-xl border border-slate-200 h-full flex flex-col items-center justify-center py-20 text-slate-400">
              <Calculator className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">Preencha os dados do cliente</p>
              <p className="text-sm mt-1">O plano previdenciário será exibido aqui</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cabeçalho */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{plano.nomeCliente}</h2>
                    <p className="text-sm text-slate-500">{plano.idadeAtual} anos · {anos(plano.tempoContribuicaoMeses)} de contribuição</p>
                  </div>
                  {plano.podeAposentar ? (
                    <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-semibold text-sm">Pode se aposentar</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-xl">
                      <Clock className="w-5 h-5" />
                      <span className="font-semibold text-sm">Faltam {anos(plano.faltaParaAposentar)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cards de informação */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Idade mínima', value: `${plano.idadeAposentadoria} anos`, sub: plano.faltaIdadeMeses === 0 ? '✓ Atingida' : `Faltam ${anos(plano.faltaIdadeMeses)}`, ok: plano.faltaIdadeMeses === 0 },
                  { label: 'Contribuição mínima', value: `${plano.contribuicaoMinimaAnos} anos`, sub: plano.faltaContribuicaoMeses === 0 ? '✓ Atingida' : `Faltam ${anos(plano.faltaContribuicaoMeses)}`, ok: plano.faltaContribuicaoMeses === 0 },
                  { label: 'Benefício estimado INSS', value: moeda(plano.estimativaBeneficio), sub: `${Math.round(plano.estimativaBeneficio / plano.salarioBruto * 100)}% do salário bruto`, ok: true },
                ].map(({ label, value, sub, ok }) => (
                  <div key={label} className={`bg-white rounded-xl border p-4 shadow-sm ${ok ? 'border-green-200' : 'border-amber-200'}`}>
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className="font-bold text-slate-800">{value}</p>
                    <p className={`text-xs mt-1 ${ok ? 'text-green-600' : 'text-amber-600'}`}>{sub}</p>
                  </div>
                ))}
              </div>

              {/* Análise financeira */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Análise Financeira na Aposentadoria
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Salário líquido atual</span>
                    <span className="font-medium text-slate-800">{moeda(plano.salarioLiquido)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Benefício INSS estimado</span>
                    <span className="font-medium text-slate-800">{moeda(plano.estimativaBeneficio)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="text-slate-500">Diferença (redução de renda)</span>
                    <span className="font-medium text-red-600">- {moeda(Math.max(0, plano.salarioLiquido - plano.estimativaBeneficio))}</span>
                  </div>
                </div>

                {plano.sugestaoPrevidenciaPrivada > 0 && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-800">Previdência Complementar Recomendada</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Para manter ~70% do padrão de vida atual, recomenda-se investir mensalmente em previdência privada (PGBL/VGBL):
                        </p>
                        <p className="text-xl font-bold text-blue-800 mt-2">{moeda(plano.sugestaoPrevidenciaPrivada)}<span className="text-sm font-normal">/mês</span></p>
                        <p className="text-xs text-blue-600 mt-1">Renda total na aposentadoria: {moeda(plano.rendaTotal)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Calculadoras rápidas toggle */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => setShowCalc(!showCalc)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-slate-700 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-slate-500" />
                    Calculadoras de Encargos
                  </span>
                  {showCalc ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {showCalc && (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Holerite Atual</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Salário Bruto</span><span>{moeda(plano.salarioBruto)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">INSS</span><span className="text-red-500">- {moeda(plano.inss)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">IRRF</span><span className="text-red-500">- {moeda(calcularIRRF(plano.salarioBruto - plano.inss))}</span></div>
                        <div className="flex justify-between font-semibold border-t pt-1"><span>Líquido</span><span className="text-green-600">{moeda(plano.salarioLiquido)}</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">FGTS</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Mensal (8%)</span><span>{moeda(plano.salarioBruto * 0.08)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Anual</span><span>{moeda(plano.salarioBruto * 0.08 * 12)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Férias brutas</span><span>{moeda(plano.salarioBruto + plano.salarioBruto / 3)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">13º bruto</span><span>{moeda(plano.salarioBruto)}</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 text-center">
                Estimativas baseadas nas tabelas INSS/IRRF 2024 e regras da reforma previdenciária (EC 103/2019). Consulte sempre um especialista.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
