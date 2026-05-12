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

  // Competências — extrato CNIS PDF
  // O pdf-parse coloca cada célula da tabela em linha separada, então:
  //   linha i+0: "01/2024"
  //   linha i+1: "EMPRESA XYZ LTDA"
  //   linha i+2: "12.345.678/0001-90"
  //   linha i+3: "Empregado"
  //   linha i+4: "3.500,00"    ← remuneração
  //   linha i+5: "315,00"      ← contribuição
  //   linha i+6: "A"           ← indicador
  // Estratégia: ao encontrar MM/AAAA, olha as próximas 8 linhas para valor + indicador.
  const competencias: Competencia[] = []
  // Mapa: chave → remuneração máxima (para múltiplos vínculos no mesmo mês)
  const melhor = new Map<string, { remuneracao: number; indicador: string }>()

  const reValor = /(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]

    // Detecta linha que começa com MM/AAAA (com ou sem texto adicional)
    const mComp = linha.match(/^(\d{2})\/(\d{4})/)
    if (!mComp) continue

    const mes = parseInt(mComp[1])
    const ano = parseInt(mComp[2])
    if (mes < 1 || mes > 12 || ano < 1976 || ano > 2030) continue

    const chave = `${mes}/${ano}`

    // Verifica se o valor já está na mesma linha (formato "01/2024 ... 3.500,00 A")
    let remuneracao = 0
    let indicador = 'A'

    const valoresNaLinha = linha.match(/[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}/g) ?? []
    if (valoresNaLinha.length > 0 && valoresNaLinha[0]) {
      remuneracao = parseFloat(valoresNaLinha[0].replace(/\./g, '').replace(',', '.')) || 0
      indicador = linha.match(/\b([AI])\s*$/)?.[1] ?? 'A'
    } else {
      // Look-ahead: busca nas próximas 8 linhas (para cada célula em linha separada)
      for (let j = i + 1; j < Math.min(i + 9, linhas.length); j++) {
        const prox = linhas[j]

        // Para se encontrar outra competência
        if (/^\d{2}\/\d{4}/.test(prox)) break

        // Detecta indicador A ou I em linha isolada
        if (/^[AI]$/.test(prox.trim())) {
          indicador = prox.trim()
          continue
        }

        // Detecta valor monetário (primeiro encontrado = remuneração)
        if (remuneracao === 0) {
          const mVal = prox.match(reValor)
          if (mVal) {
            remuneracao = parseFloat(mVal[1].replace(/\./g, '').replace(',', '.')) || 0
          }
        }
      }
    }

    // Guarda o maior valor para o mês (múltiplos vínculos)
    const anterior = melhor.get(chave)
    if (!anterior || remuneracao > anterior.remuneracao) {
      melhor.set(chave, { remuneracao, indicador })
    }
  }

  // Converte o mapa para array de competências
  for (const [chave, { remuneracao, indicador }] of melhor) {
    const [mesStr, anoStr] = chave.split('/')
    const mes = parseInt(mesStr), ano = parseInt(anoStr)
    competencias.push({
      competencia: `${String(mes).padStart(2, '0')}/${ano}`,
      ano, mes, remuneracao,
      carencia: indicador !== 'I' && remuneracao > 0,
      indicador_contribuicao: indicador,
    })
  }

  // Estratégia 2 (fallback): regex multi-linha sobre texto completo
  if (competencias.length < 3) {
    const reCompFull = /(\d{2})\/(\d{4})[\s\S]{0,200}?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/g
    const visto2 = new Set(melhor.keys())
    let m: RegExpExecArray | null
    while ((m = reCompFull.exec(texto)) !== null) {
      const mes = parseInt(m[1]), ano = parseInt(m[2])
      if (mes < 1 || mes > 12 || ano < 1976) continue
      const chave = `${mes}/${ano}`
      if (visto2.has(chave)) continue
      visto2.add(chave)
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
