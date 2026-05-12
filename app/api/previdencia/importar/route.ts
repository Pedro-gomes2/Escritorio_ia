import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsearCNIS } from '@/lib/previdencia/parser-cnis'
import { calcularBeneficio } from '@/lib/previdencia/calculos'
import pdfParse from 'pdf-parse'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const arquivo = formData.get('arquivo') as File | null
    const clienteId = formData.get('clienteId') as string | null
    const sexo = formData.get('sexo') as 'M' | 'F' | null
    const dataNascimento = formData.get('dataNascimento') as string | null

    if (!arquivo) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    const nomeArquivo = arquivo.name.toLowerCase()
    const tipo = nomeArquivo.endsWith('.xml') ? 'xml' : 'pdf'

    // Extrai texto do arquivo
    let conteudo = ''
    if (tipo === 'pdf') {
      const buffer = Buffer.from(await arquivo.arrayBuffer())
      const parsed = await pdfParse(buffer)
      conteudo = parsed.text
    } else {
      conteudo = await arquivo.text()
    }

    if (!conteudo.trim()) {
      return NextResponse.json({ error: 'Arquivo vazio ou ilegível' }, { status: 400 })
    }

    // Parsear CNIS
    const dadosCNIS = parsearCNIS(conteudo, tipo)

    // Sobrescreve sexo/nascimento se informados manualmente (mais confiável)
    if (sexo) dadosCNIS.sexo = sexo
    if (dataNascimento) {
      const [ano, mes, dia] = dataNascimento.split('-').map(Number)
      dadosCNIS.dataNascimento = new Date(ano, mes - 1, dia)
    }

    // Calcula benefício se tiver os dados necessários
    let resultado = null
    if (dadosCNIS.dataNascimento && dadosCNIS.sexo && dadosCNIS.competencias.length > 0) {
      resultado = calcularBeneficio({
        dataNascimento: dadosCNIS.dataNascimento,
        sexo: dadosCNIS.sexo,
        competencias: dadosCNIS.competencias,
        dataCalculo: new Date(),
      })
    }

    // Salva no banco se tiver clienteId
    let extratoId: string | null = null
    if (clienteId) {
      const supabase = createAdminClient()

      const primeiraComp = dadosCNIS.competencias[0]
      const ultimaComp = dadosCNIS.competencias[dadosCNIS.competencias.length - 1]

      const { data: extrato, error: errExtrato } = await supabase
        .from('cnis_extratos')
        .insert({
          cliente_id: clienteId,
          nome_segurado: dadosCNIS.nomeSegurado || null,
          cpf: dadosCNIS.cpf || null,
          data_nascimento: dadosCNIS.dataNascimento?.toISOString().split('T')[0] ?? null,
          sexo: dadosCNIS.sexo,
          total_competencias: dadosCNIS.competencias.length,
          total_vinculos: dadosCNIS.vinculos.length,
          primeira_competencia: primeiraComp
            ? `${String(primeiraComp.mes).padStart(2,'0')}/${primeiraComp.ano}` : null,
          ultima_competencia: ultimaComp
            ? `${String(ultimaComp.mes).padStart(2,'0')}/${ultimaComp.ano}` : null,
          arquivo_nome: arquivo.name,
          arquivo_tipo: tipo,
          dados_raw: {
            competencias: dadosCNIS.competencias,
            vinculos: dadosCNIS.vinculos,
            resultado,
          },
        })
        .select('id')
        .single()

      if (errExtrato) {
        console.error('Erro ao salvar extrato:', errExtrato)
      } else if (extrato) {
        extratoId = extrato.id

        // Salva competências individuais
        if (dadosCNIS.competencias.length > 0) {
          const rows = dadosCNIS.competencias.map(c => ({
            extrato_id: extrato.id,
            cliente_id: clienteId,
            competencia: c.competencia,
            ano: c.ano,
            mes: c.mes,
            remuneracao: c.remuneracao,
            carencia: c.carencia,
            indicador_contribuicao: c.indicador_contribuicao ?? 'A',
          }))
          await supabase.from('cnis_competencias').insert(rows)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      extratoId,
      dados: {
        nomeSegurado: dadosCNIS.nomeSegurado,
        cpf: dadosCNIS.cpf,
        dataNascimento: dadosCNIS.dataNascimento?.toISOString() ?? null,
        sexo: dadosCNIS.sexo,
        totalCompetencias: dadosCNIS.competencias.length,
        totalVinculos: dadosCNIS.vinculos.length,
        competencias: dadosCNIS.competencias,
        erros: dadosCNIS.erros,
      },
      resultado,
    })
  } catch (err) {
    console.error('Erro ao importar CNIS:', err)
    return NextResponse.json({ error: 'Erro ao processar arquivo' }, { status: 500 })
  }
}
