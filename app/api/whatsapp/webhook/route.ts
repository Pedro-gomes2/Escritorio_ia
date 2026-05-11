import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.event !== 'messages.upsert') {
      return NextResponse.json({ ok: true })
    }

    const data = body.data
    if (data?.key?.fromMe) {
      return NextResponse.json({ ok: true })
    }

    const jid: string = data?.key?.remoteJid ?? ''
    if (!jid || jid.includes('@g.us')) {
      return NextResponse.json({ ok: true })
    }

    const telefone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
    const nome = data?.pushName || data?.verifiedBizName || telefone
    const texto: string =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.imageMessage?.caption ||
      '[Mídia recebida]'
    const timestamp = new Date((data?.messageTimestamp ?? Date.now() / 1000) * 1000).toISOString()

    const novaMensagem = { texto, timestamp, de: nome }
    const supabase = createAdminClient()

    const { data: existente } = await supabase
      .from('atendimentos_whatsapp')
      .select('id, mensagens')
      .eq('whatsapp_jid', jid)
      .neq('coluna', 'finalizado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existente) {
      const mensagens = Array.isArray(existente.mensagens) ? existente.mensagens : []
      await supabase
        .from('atendimentos_whatsapp')
        .update({
          mensagens: [...mensagens, novaMensagem],
          ultima_mensagem: texto,
          ultimo_contato: timestamp,
        })
        .eq('id', existente.id)
    } else {
      await supabase.from('atendimentos_whatsapp').insert({
        nome,
        telefone,
        whatsapp_jid: jid,
        assunto: texto.slice(0, 200),
        coluna: 'novo',
        mensagens: [novaMensagem],
        ultima_mensagem: texto,
        ultimo_contato: timestamp,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook WhatsApp erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
