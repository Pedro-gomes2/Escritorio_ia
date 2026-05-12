/**
 * Parser de Extrato CNIS
 * Suporta PDF (texto extraído) e XML (formato Meu INSS)
 */

import type { Competencia } from './calculos'

export interface DadosCNIS {
  nomeSegurado: string
  cpf: string
  dataNascimento: Date | null
  sexo: 'M' | 'F' | null
  competencias: Competencia[]
  vinculos: VinculoCNIS[]
  erros: string[]
}

export interface VinculoCNIS {
  empregador: string
  cnpj: string
  tipo: string
  dataInicio: string
  dataFim: string
  competencias: Competencia[]
}

// ─── Parser XML ───────────────────────────────────────────────────────────────
export function parsearCNISXml(xmlText: string): DadosCNIS {
  const erros: string[] = []

  // Extrai tag simples
  function tag(nome: string): string {
    const m = xmlText.match(new RegExp(`<${nome}[^>]*>([^<]*)</${nome}>`, 'i'))
    return m?.[1]?.trim() ?? ''
  }

  // Nome e CPF do segurado
  const nomeSegurado = tag('NomeSegurado') || tag('nome') || tag('NM_SEGURADO') || ''
  const cpfRaw = tag('CPF') || tag('NrCpf') || tag('cpf') || ''
  const cpf = cpfRaw.replace(/\D/g, '')

  // Data de nascimento
  const nascRaw = tag('DataNascimento') || tag('DtNascimento') || tag('dtNascimento') || ''
  let dataNascimento: Date | null = null
  if (nascRaw) {
    // Formatos: DD/MM/AAAA ou AAAA-MM-DD
    const partes = nascRaw.includes('/') ? nascRaw.split('/').reverse() : nascRaw.split('-')
    if (partes.length === 3) {
      dataNascimento = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]))
    }
  }

  // Sexo
  const sexoRaw = (tag('Sexo') || tag('sexo') || tag('SexoPessoa') || '').toUpperCase()
  const sexo: 'M' | 'F' | null = sexoRaw === 'M' || sexoRaw === 'MASCULINO' ? 'M'
    : sexoRaw === 'F' || sexoRaw === 'FEMININO' ? 'F' : null

  // Extrai todos os vínculos e competências
  const competencias: Competencia[] = []
  const vinculos: VinculoCNIS[] = []

  // Tenta diferentes padrões de XML do CNIS/Meu INSS
  const blocoVinculos = xmlText.match(/<Vinculo[\s\S]*?<\/Vinculo>/gi) ?? []
  const blocoContribs = xmlText.match(/<Contribuicao[\s\S]*?<\/Contribuicao>/gi) ?? []
  const blocoRemuns = xmlText.match(/<Remuneracao[\s\S]*?<\/Remuneracao>/gi) ?? []

  // Padrão 1: blocos de Vínculos com competências internas
  for (const bloco of blocoVinculos) {
    const empregador = bloco.match(/<NomeEmpregador>([^<]*)<\/NomeEmpregador>/i)?.[1]?.trim() ?? ''
    const cnpj = bloco.match(/<CNPJ[^>]*>([^<]*)<\/CNPJ>/i)?.[1]?.replace(/\D/g, '') ?? ''
    const tipo = bloco.match(/<TipoFiliacao>([^<]*)<\/TipoFiliacao>/i)?.[1]?.trim()
      ?? bloco.match(/<CdTipoFiliacao>([^<]*)<\/CdTipoFiliacao>/i)?.[1]?.trim() ?? ''
    const dataInicio = bloco.match(/<DataInicio>([^<]*)<\/DataInicio>/i)?.[1]?.trim() ?? ''
    const dataFim = bloco.match(/<DataFim>([^<]*)<\/DataFim>/i)?.[1]?.trim() ?? ''

    const compsBloco: Competencia[] = []
    const compMatches = bloco.match(/<Competencia[\s\S]*?<\/Competencia>/gi) ?? []

    for (const comp of compMatches) {
      const c = parsearCompetenciaXml(comp, empregador, cnpj, tipo)
      if (c) { compsBloco.push(c); competencias.push(c) }
    }

    vinculos.push({ empregador, cnpj, tipo, dataInicio, dataFim, competencias: compsBloco })
  }

  // Padrão 2: lista flat de contribuições
  if (competencias.length === 0) {
    for (const bloco of [...blocoContribs, ...blocoRemuns]) {
      const c = parsearCompetenciaXml(bloco, '', '', '')
      if (c) competencias.push(c)
    }
  }

  if (competencias.length === 0) {
    erros.push('Nenhuma competência encontrada no XML. Verifique o formato do arquivo.')
  }

  return { nomeSegurado, cpf, dataNascimento, sexo, competencias, vinculos, erros }
}

function parsearCompetenciaXml(bloco: string, empregador: string, cnpj: string, tipo: string): Competencia | null {
  // Competência no formato MM/AAAA ou AAAA-MM
  const compRaw = bloco.match(/<Competencia>([^<]*)<\/Competencia>/i)?.[1]?.trim()
    ?? bloco.match(/<DtCompetencia>([^<]*)<\/DtCompetencia>/i)?.[1]?.trim()
    ?? bloco.match(/<competencia>([^<]*)<\/competencia>/i)?.[1]?.trim()
    ?? ''

  if (!compRaw) return null

  let mes = 0, ano = 0
  if (compRaw.includes('/')) {
    const p = compRaw.split('/')
    mes = parseInt(p[0]); ano = parseInt(p[1])
  } else if (compRaw.includes('-')) {
    const p = compRaw.split('-')
    ano = parseInt(p[0]); mes = parseInt(p[1])
  }

  if (!mes || !ano || mes < 1 || mes > 12 || ano < 1990) return null

  const remRaw = bloco.match(/<Remuneracao>([^<]*)<\/Remuneracao>/i)?.[1]
    ?? bloco.match(/<VlRemuneracao>([^<]*)<\/VlRemuneracao>/i)?.[1]
    ?? bloco.match(/<valorRemuneracao>([^<]*)<\/valorRemuneracao>/i)?.[1]
    ?? '0'
  const remuneracao = parseFloat(remRaw.replace(',', '.')) || 0

  const contRaw = bloco.match(/<Contribuicao>([^<]*)<\/Contribuicao>/i)?.[1]
    ?? bloco.match(/<VlContribuicao>([^<]*)<\/VlContribuicao>/i)?.[1]
    ?? '0'
  const contribuicao = parseFloat(contRaw.replace(',', '.')) || 0

  const indicador = bloco.match(/<IndicadorContribuicao>([^<]*)<\/IndicadorContribuicao>/i)?.[1]?.trim()
    ?? bloco.match(/<IndContribuicao>([^<]*)<\/IndContribuicao>/i)?.[1]?.trim()
    ?? 'A'

  return {
    competencia: `${String(mes).padStart(2, '0')}/${ano}`,
    ano, mes, remuneracao, contribuicao: contribuicao,
    carencia: indicador !== 'I' && remuneracao > 0,
    indicador_contribuicao: indicador,
    empregador, cnpj_empregador: cnpj, tipo_filiacao: tipo,
  } as Competencia & { contribuicao: number; empregador: string; cnpj_empregador: string; tipo_filiacao: string }
}

// ─── Parser PDF (texto extraído) ──────────────────────────────────────────────
export function parsearCNISPdf(texto: string): DadosCNIS {
  const erros: string[] = []
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)

  // Nome do segurado
  let nomeSegurado = ''
  for (let i = 0; i < linhas.length; i++) {
    if (/nome.*segurado/i.test(linhas[i]) || /segurado/i.test(linhas[i])) {
      // Nome geralmente está na mesma linha ou na próxima
      const mSameLine = linhas[i].match(/(?:segurado|nome)[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÀÜ\s]{5,})/i)
      if (mSameLine) { nomeSegurado = mSameLine[1].trim(); break }
      if (i + 1 < linhas.length && /^[A-ZÁÉÍÓÚÂÊÔÃÕÀÜ\s]{5,}$/.test(linhas[i + 1])) {
        nomeSegurado = linhas[i + 1]; break
      }
    }
  }

  // CPF
  let cpf = ''
  const mCPF = texto.match(/CPF[:\s]*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[.\s-]?\d{2})/i)
  if (mCPF) cpf = mCPF[1].replace(/\D/g, '')

  // Data de nascimento
  let dataNascimento: Date | null = null
  const mNasc = texto.match(/(?:nascimento|data\s*nasc)[:\s]*(\d{2}\/\d{2}\/\d{4})/i)
  if (mNasc) {
    const p = mNasc[1].split('/')
    dataNascimento = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
  }

  // Sexo
  let sexo: 'M' | 'F' | null = null
  if (/\b(masculino|homem)\b/i.test(texto)) sexo = 'M'
  else if (/\b(feminino|mulher)\b/i.test(texto)) sexo = 'F'

  // Competências — padrão principal do extrato CNIS impresso/PDF
  // Linha típica: "01/2020  EMPRESA XYZ  1234567890  Empregado  R$ 3.500,00  R$ 315,00  A"
  const competencias: Competencia[] = []
  const visto = new Set<string>()

  // Regex para competência no formato MM/AAAA seguida de valores monetários
  const reComp = /(\d{2}\/\d{4})\s+(.{3,50?})\s+([\d.,]+)\s*(?:A|I)?\s*$/gm
  const reCompSimples = /(\d{2})\/(\d{4})\s[\s\S]{0,100}?([\d]{1,3}(?:\.\d{3})*,\d{2})/g

  // Estratégia 1: linha por linha, detectar padrão MM/AAAA + valor
  for (const linha of linhas) {
    const mComp = linha.match(/^(\d{2})\/(\d{4})/)
    if (!mComp) continue

    const mes = parseInt(mComp[1])
    const ano = parseInt(mComp[2])
    if (mes < 1 || mes > 12 || ano < 1976 || ano > 2030) continue

    const chave = `${mes}/${ano}`
    if (visto.has(chave)) continue

    // Extrai valor monetário da linha
    const valores = linha.match(/[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}/g) ?? []
    const remuneracao = valores.length > 0 && valores[0]
      ? parseFloat(valores[0].replace(/\./g, '').replace(',', '.'))
      : 0

    // Indicador A/I no fim da linha
    const indicador = linha.match(/\b([AI])\s*$/)?.[1] ?? 'A'

    // Empregador: texto entre a competência e o valor
    const empregador = linha.replace(/^\d{2}\/\d{4}\s*/, '').replace(/[\d.,]+.*$/, '').trim()

    visto.add(chave)
    competencias.push({
      competencia: `${String(mes).padStart(2, '0')}/${ano}`,
      ano, mes, remuneracao,
      carencia: indicador !== 'I' && remuneracao > 0,
      indicador_contribuicao: indicador,
    })
  }

  // Estratégia 2: regex sobre texto completo (fallback)
  if (competencias.length < 3) {
    let m: RegExpExecArray | null
    reComp.lastIndex = 0
    while ((m = reComp.exec(texto)) !== null) {
      const [mesStr, anoStr] = m[1].split('/')
      const mes = parseInt(mesStr), ano = parseInt(anoStr)
      if (mes < 1 || mes > 12 || ano < 1976) continue
      const chave = `${mes}/${ano}`
      if (visto.has(chave)) continue
      visto.add(chave)
      const remuneracao = parseFloat(m[3].replace(/\./g, '').replace(',', '.')) || 0
      competencias.push({
        competencia: `${String(mes).padStart(2, '0')}/${ano}`,
        ano, mes, remuneracao,
        carencia: remuneracao > 0,
        indicador_contribuicao: 'A',
      })
    }
  }

  // Ordena cronologicamente
  competencias.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes)

  if (competencias.length === 0) {
    erros.push('Nenhuma competência identificada no PDF. Para melhores resultados, use o formato XML do Meu INSS.')
  }

  return { nomeSegurado, cpf, dataNascimento, sexo, competencias, vinculos: [], erros }
}

// ─── Entrada unificada ────────────────────────────────────────────────────────
export function parsearCNIS(conteudo: string, tipo: 'pdf' | 'xml'): DadosCNIS {
  if (tipo === 'xml') return parsearCNISXml(conteudo)
  return parsearCNISPdf(conteudo)
}
