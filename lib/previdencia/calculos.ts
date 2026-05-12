/**
 * Engine de Cálculo Previdenciário — RGPS (INSS)
 * Regras: EC 103/2019 + Regras de Transição
 */

export interface Competencia {
  competencia: string  // MM/AAAA
  ano: number
  mes: number
  remuneracao: number
  carencia: boolean
  indicador_contribuicao?: string
}

export interface DadosSegurado {
  dataNascimento: Date
  sexo: 'M' | 'F'
  competencias: Competencia[]
  dataCalculo?: Date  // default: hoje
}

export interface ResultadoSalarioBeneficio {
  mediaTotal: number           // média 100% (pós-reforma)
  mediaMelhores80: number      // média 80% (pré-reforma)
  totalCompetencias: number
  competenciasUsadas80: number
  periodoApuracao: string      // ex: "07/1994 a 12/2023"
}

export interface ResultadoTransicao {
  regra: string
  descricao: string
  elegivel: boolean
  dataElegibilidade: Date | null
  mesesRestantes: number       // 0 = já pode, >0 = falta X meses
  detalhe: string
  pontos?: number              // para regra de pontos
}

export interface ResultadoBeneficio {
  salarioBeneficio: ResultadoSalarioBeneficio
  transicoes: ResultadoTransicao[]
  melhorRegra: ResultadoTransicao | null
  totalContribuicaoMeses: number
  totalCarenciaMeses: number
  idadeAtual: number
  idadeAtualMeses: number
  tempoContribuicaoAnos: number
  tempoContribuicaoMeses: number
  coeficiente: number          // % do salário de benefício
  beneficioEstimado: number    // valor mensal estimado
  teto: number                 // teto RGPS 2024
}

// ─── Constantes 2024 ─────────────────────────────────────────────────────────
const TETO_RGPS_2024 = 7786.02
const PISO_RGPS_2024 = 1412.00  // salário mínimo 2024

// Carência mínima (meses)
const CARENCIA_APOSENTADORIA = 180  // 15 anos

// Requisitos mínimos pós-reforma (regra definitiva)
const REQUISITOS_DEFINITIVOS = {
  M: { idadeMin: 65, tcMin: 240 },   // 65 anos, 20 anos
  F: { idadeMin: 62, tcMin: 180 },   // 62 anos, 15 anos
}

// Regra de pontos 2024 (cresce 1 por ano até 2033)
// Homem: 96 em 2019, cresce até 105 em 2028
// Mulher: 86 em 2019, cresce até 100 em 2033
function getPontosMinimos(sexo: 'M' | 'F', ano: number): number {
  if (sexo === 'M') {
    const base = 96
    const crescimento = Math.min(ano - 2019, 9)  // máx 9 anos = 105
    return Math.min(base + crescimento, 105)
  } else {
    const base = 86
    const crescimento = Math.min(ano - 2019, 14) // máx 14 anos = 100
    return Math.min(base + crescimento, 100)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function diffMeses(de: Date, ate: Date): number {
  return (ate.getFullYear() - de.getFullYear()) * 12
    + (ate.getMonth() - de.getMonth())
}

function addMeses(data: Date, meses: number): Date {
  const d = new Date(data)
  d.setMonth(d.getMonth() + meses)
  return d
}

function idadeEmMeses(nascimento: Date, referencia: Date): number {
  return diffMeses(nascimento, referencia)
}

// Filtra competências a partir de Jul/1994 (Plano Real — marco legal RGPS)
function filtrarCompetenciasValidas(competencias: Competencia[]): Competencia[] {
  return competencias.filter(c =>
    c.remuneracao > 0 &&
    (c.ano > 1994 || (c.ano === 1994 && c.mes >= 7))
  )
}

// ─── Salário de Benefício ─────────────────────────────────────────────────────
export function calcularSalarioBeneficio(
  competencias: Competencia[],
  dataCalculo: Date
): ResultadoSalarioBeneficio {
  const validas = filtrarCompetenciasValidas(competencias)
    .filter(c => c.remuneracao > 0)
    .sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes)

  if (validas.length === 0) {
    return { mediaTotal: 0, mediaMelhores80: 0, totalCompetencias: 0, competenciasUsadas80: 0, periodoApuracao: '-' }
  }

  // Aplicar teto RGPS em cada competência
  const remuneracoes = validas.map(c => Math.min(c.remuneracao, TETO_RGPS_2024))

  // Média 100% — pós-reforma EC 103/2019
  const somaTotal = remuneracoes.reduce((s, v) => s + v, 0)
  const mediaTotal = somaTotal / remuneracoes.length

  // Média melhores 80% — pré-reforma
  const ordenadas = [...remuneracoes].sort((a, b) => b - a)
  const qtd80 = Math.ceil(remuneracoes.length * 0.8)
  const melhores80 = ordenadas.slice(0, qtd80)
  const mediaMelhores80 = melhores80.reduce((s, v) => s + v, 0) / melhores80.length

  const primeira = validas[0]
  const ultima = validas[validas.length - 1]
  const periodoApuracao = `${String(primeira.mes).padStart(2, '0')}/${primeira.ano} a ${String(ultima.mes).padStart(2, '0')}/${ultima.ano}`

  return {
    mediaTotal: Math.max(mediaTotal, PISO_RGPS_2024),
    mediaMelhores80: Math.max(mediaMelhores80, PISO_RGPS_2024),
    totalCompetencias: validas.length,
    competenciasUsadas80: qtd80,
    periodoApuracao,
  }
}

// ─── Coeficiente (% do SB) ────────────────────────────────────────────────────
// EC 103/2019: começa em 60%, +2% por ano acima do mínimo
export function calcularCoeficiente(tcMeses: number, sexo: 'M' | 'F'): number {
  const tcMinMeses = sexo === 'M' ? 240 : 180  // 20 ou 15 anos
  const anosAcima = Math.max(0, Math.floor((tcMeses - tcMinMeses) / 12))
  return Math.min(0.60 + anosAcima * 0.02, 1.0)  // máx 100%
}

// ─── Regras de Transição ──────────────────────────────────────────────────────
function regraDefinitiva(dados: DadosSegurado, dataCalculo: Date, tcMeses: number): ResultadoTransicao {
  const req = REQUISITOS_DEFINITIVOS[dados.sexo]
  const idMeses = idadeEmMeses(dados.dataNascimento, dataCalculo)
  const idAnos = idMeses / 12

  const faltaIdadeMeses = Math.max(0, req.idadeMin * 12 - idMeses)
  const faltaTCMeses = Math.max(0, req.tcMin - tcMeses)
  const faltaMeses = Math.max(faltaIdadeMeses, faltaTCMeses)

  const elegivel = faltaMeses === 0
  const dataEleg = elegivel ? dataCalculo : addMeses(dataCalculo, faltaMeses)

  return {
    regra: 'Regra Definitiva',
    descricao: `${req.idadeMin} anos + ${req.tcMin / 12} anos de contribuição`,
    elegivel,
    dataElegibilidade: dataEleg,
    mesesRestantes: faltaMeses,
    detalhe: elegivel
      ? `Requisitos cumpridos (${idAnos.toFixed(1)} anos / ${(tcMeses / 12).toFixed(1)} anos TC)`
      : `Falta ${faltaIdadeMeses > 0 ? `${Math.ceil(faltaIdadeMeses / 12)} anos de idade` : ''} ${faltaTCMeses > 0 ? `${Math.ceil(faltaTCMeses / 12)} anos de contribuição` : ''}`.trim(),
  }
}

function regraPontos(dados: DadosSegurado, dataCalculo: Date, tcMeses: number): ResultadoTransicao {
  const idMeses = idadeEmMeses(dados.dataNascimento, dataCalculo)
  const pontos = idMeses / 12 + tcMeses / 12  // idade + TC em anos

  // Pontos mínimos para o ano atual
  const pontosMin = getPontosMinimos(dados.sexo, dataCalculo.getFullYear())

  // Também requer TC mínimo
  const tcMin = dados.sexo === 'M' ? 240 : 180
  const faltaTC = Math.max(0, tcMin - tcMeses)

  // Calcular quando vai atingir os pontos
  let faltaMeses = 0
  if (pontos < pontosMin || faltaTC > 0) {
    // Cada mês: +1/12 de ponto de TC + o piso sobe 1/12/ano
    // Simplificação: simula mês a mês até atingir
    let mes = 0
    let tcSim = tcMeses
    while (mes < 600) {  // máx 50 anos
      mes++
      tcSim++
      const anoSim = addMeses(dataCalculo, mes).getFullYear()
      const idSim = (idMeses + mes) / 12
      const tcAnos = tcSim / 12
      const pontosSim = idSim + tcAnos
      const pontosMinSim = getPontosMinimos(dados.sexo, anoSim)
      const tcMinOk = tcSim >= tcMin
      if (pontosSim >= pontosMinSim && tcMinOk) {
        faltaMeses = mes
        break
      }
    }
  }

  const elegivel = faltaMeses === 0
  const dataEleg = elegivel ? dataCalculo : addMeses(dataCalculo, faltaMeses)

  return {
    regra: 'Regra de Pontos',
    descricao: `${pontosMin} pontos (idade + TC) sem idade mínima`,
    elegivel,
    dataElegibilidade: dataEleg,
    mesesRestantes: faltaMeses,
    pontos: Math.floor(pontos * 10) / 10,
    detalhe: elegivel
      ? `${pontos.toFixed(1)} pontos atingidos (mín. ${pontosMin})`
      : `Tem ${pontos.toFixed(1)} pontos, precisa de ${pontosMin} (crescendo até ${dados.sexo === 'M' ? 105 : 100})`,
  }
}

function regraPedagio50(dados: DadosSegurado, dataCalculo: Date, tcMeses: number): ResultadoTransicao {
  // Na data da reforma (13/11/2019), quanto faltava?
  const dataReforma = new Date(2019, 10, 13)  // nov/2019
  const tcNaReforma = tcMeses - Math.max(0, diffMeses(dataReforma, dataCalculo))
  const tcMin = dados.sexo === 'M' ? 240 : 180
  const faltavaNaReforma = Math.max(0, tcMin - tcNaReforma)
  const pedagio = Math.ceil(faltavaNaReforma * 0.5)

  const tcNecessario = tcMin + pedagio
  const faltaTC = Math.max(0, tcNecessario - tcMeses)

  const elegivel = faltaTC === 0 && tcMeses >= tcMin
  const dataEleg = elegivel ? dataCalculo : addMeses(dataCalculo, faltaTC)

  return {
    regra: 'Pedágio 50%',
    descricao: `TC mínimo + 50% do tempo faltante em nov/2019 (sem idade mínima)`,
    elegivel,
    dataElegibilidade: dataEleg,
    mesesRestantes: faltaTC,
    detalhe: elegivel
      ? `Concluído! Precisava de ${tcNecessario / 12} anos (${tcMin / 12} + pedágio ${pedagio / 12} anos)`
      : `Falta ${Math.ceil(faltaTC / 12)} anos. Total necessário: ${tcNecessario / 12} anos (pedágio: ${pedagio} meses)`,
  }
}

function regraPedagio100(dados: DadosSegurado, dataCalculo: Date, tcMeses: number): ResultadoTransicao {
  const dataReforma = new Date(2019, 10, 13)
  const tcNaReforma = tcMeses - Math.max(0, diffMeses(dataReforma, dataCalculo))
  const tcMin = dados.sexo === 'M' ? 240 : 180
  const faltavaNaReforma = Math.max(0, tcMin - tcNaReforma)
  const pedagio = faltavaNaReforma  // 100%

  const idadeMin = dados.sexo === 'M' ? 57 : 52  // idades da regra 100%
  const tcNecessario = tcMin + pedagio

  const idMeses = idadeEmMeses(dados.dataNascimento, dataCalculo)
  const faltaIdade = Math.max(0, idadeMin * 12 - idMeses)
  const faltaTC = Math.max(0, tcNecessario - tcMeses)
  const faltaMeses = Math.max(faltaIdade, faltaTC)

  const elegivel = faltaMeses === 0 && tcMeses >= tcMin
  const dataEleg = elegivel ? dataCalculo : addMeses(dataCalculo, faltaMeses)

  return {
    regra: 'Pedágio 100%',
    descricao: `TC mínimo + 100% do tempo faltante + ${idadeMin} anos (${dados.sexo === 'M' ? 'H' : 'M'})`,
    elegivel,
    dataElegibilidade: dataEleg,
    mesesRestantes: faltaMeses,
    detalhe: elegivel
      ? `Concluído! Precisava de ${tcNecessario / 12} anos + ${idadeMin} anos de idade`
      : `Falta ${Math.ceil(faltaTC / 12)} anos TC e/ou ${Math.ceil(faltaIdade / 12)} anos de idade`,
  }
}

function regraIdadeProgressiva(dados: DadosSegurado, dataCalculo: Date, tcMeses: number): ResultadoTransicao {
  // Idade mínima cresce 6 meses por ano a partir de 2020
  // H: 61 em 2020 → 65 em 2027 | M: 56 em 2020 → 62 em 2032
  const req = REQUISITOS_DEFINITIVOS[dados.sexo]
  const idadeBase = dados.sexo === 'M' ? 56 : 61
  const idMin2020 = idadeBase * 12  // em meses

  // Calcula qual é a idade mínima vigente hoje
  const anoAtual = dataCalculo.getFullYear()
  const anosMaisDe2020 = Math.max(0, anoAtual - 2020)
  const crescimentoMeses = Math.min(anosMaisDe2020 * 6, (req.idadeMin - idadeBase) * 12)
  const idadeMinHoje = (idMin2020 + crescimentoMeses) / 12  // em anos

  const idMeses = idadeEmMeses(dados.dataNascimento, dataCalculo)
  const tcMin = req.tcMin

  const faltaIdade = Math.max(0, (idadeMinHoje * 12) - idMeses)
  const faltaTC = Math.max(0, tcMin - tcMeses)

  // Simula mês a mês
  let faltaMeses = 0
  if (faltaIdade > 0 || faltaTC > 0) {
    let mes = 0
    let tcSim = tcMeses
    while (mes < 600) {
      mes++
      tcSim++
      const dataSim = addMeses(dataCalculo, mes)
      const anoSim = dataSim.getFullYear()
      const anosMais = Math.max(0, anoSim - 2020)
      const cresc = Math.min(anosMais * 6, (req.idadeMin - idadeBase) * 12)
      const idMinSim = (idMin2020 + cresc) / 12
      const idSim = (idMeses + mes) / 12
      if (idSim >= idMinSim && tcSim >= tcMin) {
        faltaMeses = mes
        break
      }
    }
  }

  const elegivel = faltaMeses === 0 && faltaIdade === 0 && faltaTC === 0
  const dataEleg = elegivel ? dataCalculo : addMeses(dataCalculo, faltaMeses)

  return {
    regra: 'Idade Progressiva',
    descricao: `Idade crescendo até ${req.idadeMin} anos + ${req.tcMin / 12} anos TC`,
    elegivel,
    dataElegibilidade: dataEleg,
    mesesRestantes: faltaMeses,
    detalhe: elegivel
      ? `Cumprido (idade min. atual: ${idadeMinHoje.toFixed(1)} anos)`
      : `Idade mínima hoje: ${idadeMinHoje.toFixed(1)} anos | Tem: ${(idMeses / 12).toFixed(1)} anos | TC: ${(tcMeses / 12).toFixed(1)} anos`,
  }
}

// ─── Cálculo principal ────────────────────────────────────────────────────────
export function calcularBeneficio(dados: DadosSegurado): ResultadoBeneficio {
  const dataCalculo = dados.dataCalculo ?? new Date()

  // Filtra e conta contribuições
  const competenciasValidas = filtrarCompetenciasValidas(dados.competencias)
  const comCarencia = dados.competencias.filter(c => c.carencia !== false)

  const tcMeses = competenciasValidas.length  // tempo de contribuição total
  const carenciaMeses = comCarencia.length

  const idMeses = idadeEmMeses(dados.dataNascimento, dataCalculo)

  // Salário de benefício
  const salarioBeneficio = calcularSalarioBeneficio(dados.competencias, dataCalculo)

  // Coeficiente
  const coeficiente = calcularCoeficiente(tcMeses, dados.sexo)

  // Benefício estimado (pós-reforma: média 100% × coeficiente)
  const beneficioEstimado = Math.max(
    Math.min(salarioBeneficio.mediaTotal * coeficiente, TETO_RGPS_2024),
    PISO_RGPS_2024
  )

  // Regras de transição
  const transicoes: ResultadoTransicao[] = [
    regraPontos(dados, dataCalculo, tcMeses),
    regraPedagio50(dados, dataCalculo, tcMeses),
    regraPedagio100(dados, dataCalculo, tcMeses),
    regraIdadeProgressiva(dados, dataCalculo, tcMeses),
    regraDefinitiva(dados, dataCalculo, tcMeses),
  ]

  // Melhor regra = elegível com data mais próxima
  const elegiveis = transicoes.filter(t => t.elegivel)
  const proximas = transicoes.filter(t => !t.elegivel && t.dataElegibilidade)
    .sort((a, b) => a.mesesRestantes - b.mesesRestantes)

  const melhorRegra = elegiveis[0] ?? proximas[0] ?? null

  return {
    salarioBeneficio,
    transicoes,
    melhorRegra,
    totalContribuicaoMeses: tcMeses,
    totalCarenciaMeses: carenciaMeses,
    idadeAtual: Math.floor(idMeses / 12),
    idadeAtualMeses: idMeses % 12,
    tempoContribuicaoAnos: Math.floor(tcMeses / 12),
    tempoContribuicaoMeses: tcMeses % 12,
    coeficiente,
    beneficioEstimado,
    teto: TETO_RGPS_2024,
  }
}

// ─── Formatação ───────────────────────────────────────────────────────────────
export function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarData(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
}

export function formatarCompetencia(mes: number, ano: number): string {
  return `${String(mes).padStart(2, '0')}/${ano}`
}
