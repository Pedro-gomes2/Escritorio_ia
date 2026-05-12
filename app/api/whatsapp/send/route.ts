import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EVO_URL = process.env.EVOLUTION_API_URL!
const EVO_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = process.env.EVOLUTION_INSTANCE!

export async function POST(req: NextRequest) {
  try {
    const { jid, mensagem, atendimentoId } = await req.json()

    if (!jid || !mensagem?.trim()) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    if (!EVO_URL || !EVO_KEY || !INSTANCE) {
      console.error('Variáveis de ambiente faltando:', { EVO_URL: !!EVO_URL, EVO_KEY: !!EVO_KEY, INSTANCE: !!INSTANCE })
      return NextResponse.json({ error: 'Variáveis de ambiente não configuradas no servidor' }, { status: 500 })
    }

    // Extrai número limpo do JID
    // JIDs @lid são identificadores internos do WhatsApp — precisamos do número real
    let numero = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '')

    // Se ainda parece LID (número muito longo ou sem prefixo de país), busca o atendimento
    if (jid.includes('@lid') && atendimentoId) {
      const supabase = createAdminClient()
      const { data: atend } = await supabase
        .from('atendimentos_whatsapp')
        .select('telefone')
        .eq('id', atendimentoId)
        .single()
      if (atend?.telefone) {
        numero = atend.telefone.replace(/\D/g, '')
        if (!numero.startsWith('55')) numero = '55' + numero
      } else {
        return NextResponse.json({
          error: 'Contato usa formato LID — adicione o telefone manualmente no card para poder responder'
        }, { status: 400 })
      }
    }

    // Envia mensagem via Evolution API v1
    const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVO_KEY,
      },
      body: JSON.stringify({
        number: numero,
        textMessage: { text: mensagem.trim() },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Erro Evolution API:', res.status, err)
      return NextResponse.json({ error: `Evolution API ${res.status}: ${err}` }, { status: 500 })
    }

    // Salva a mensagem enviada no histórico do atendimento
    if (atendimentoId) {
      const supabase = createAdminClient()
      const { data: atendimento } = await supabase
        .from('atendimentos_whatsapp')
        .select('mensagens')
        .eq('id', atendimentoId)
        .single()

      if (atendimento) {
        const mensagens = Array.isArray(atendimento.mensagens) ? atendimento.mensagens : []
        await supabase
          .from('atendimentos_whatsapp')
          .update({
            mensagens: [...mensagens, {
              texto: mensagem.trim(),
              timestamp: new Date().toISOString(),
              de: 'Você',
            }],
            ultima_mensagem: mensagem.trim(),
            ultimo_contato: new Date().toISOString(),
          })
          .eq('id', atendimentoId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Erro envio WhatsApp:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
