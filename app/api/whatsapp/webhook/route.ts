import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EVO_URL = process.env.EVOLUTION_API_URL!
const EVO_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = process.env.EVOLUTION_INSTANCE!

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

    const isLid = jid.includes('@lid')
    let telefone: string | null = null

    if (isLid) {
      // Consulta a Evolution API para obter o número real a partir do LID
      const lidNumero = jid.replace('@lid', '')
      try {
        const res = await fetch(`${EVO_URL}/chat/whatsappNumbers/${INSTANCE}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
          body: JSON.stringify({ numbers: [lidNumero] }),
        })
        if (res.ok) {
          const result = await res.json()
          const contato = Array.isArray(result) ? result[0] : result
          if (contato?.number) telefone = contato.number
          else if (contato?.jid) telefone = contato.jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
        }
      } catch { /* mantém null se falhar */ }
    } else {
      telefone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
    }
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
      .select('id, mensagens, telefone')
      .eq('whatsapp_jid', jid)
      .neq('coluna', 'finalizado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existente) {
      const mensagens = Array.isArray(existente.mensagens) ? existente.mensagens : []
      const updatePayload: Record<string, unknown> = {
        mensagens: [...mensagens, novaMensagem],
        ultima_mensagem: texto,
        ultimo_contato: timestamp,
        nao_lido: true,
      }
      // Atualiza telefone se estava null e agora temos o número real
      if (telefone && !existente.telefone) updatePayload.telefone = telefone

      await supabase
        .from('atendimentos_whatsapp')
        .update(updatePayload)
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
        nao_lido: true,
        tags: [],
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
