import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EVO_URL = process.env.EVOLUTION_API_URL!
const EVO_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = process.env.EVOLUTION_INSTANCE!

// Resolve número real a partir de um JID @lid via Evolution API
async function resolverLid(lidNumero: string): Promise<string | null> {
  try {
    const res = await fetch(`${EVO_URL}/chat/whatsappNumbers/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ numbers: [lidNumero] }),
    })
    if (!res.ok) return null
    const result = await res.json()
    const contato = Array.isArray(result) ? result[0] : result
    if (contato?.number) return String(contato.number)
    if (contato?.jid) return contato.jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
    return null
  } catch {
    return null
  }
}

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
    let whatsappJidEnvio = jid

    if (isLid) {
      // 1. Tenta extrair do campo sender (JID real com número)
      const sender: string = data?.sender ?? ''
      if (sender.includes('@s.whatsapp.net') || sender.includes('@c.us')) {
        telefone = sender.replace('@s.whatsapp.net', '').replace('@c.us', '')
        whatsappJidEnvio = sender
      }

      // 2. Fallback: chama Evolution API para resolver o LID
      if (!telefone) {
        const lidNumero = jid.replace('@lid', '')
        const numero = await resolverLid(lidNumero)
        if (numero) {
          telefone = numero
          whatsappJidEnvio = `${numero}@s.whatsapp.net`
        }
      }

      console.log('[webhook @lid]', { jid, sender: data?.sender, telefoneResolvido: telefone })
    } else {
      telefone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
    }

    const nome: string = data?.pushName || data?.verifiedBizName || telefone || 'Desconhecido'

    // ── Texto e mídia ───────────────────────────────────────────────────────
    const msg = data?.message ?? {}

    const texto: string =
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      msg.documentMessage?.caption ||
      ''

    // Tipo de mídia detectado
    const tipoMidia: string | null =
      msg.imageMessage    ? 'imagem'    :
      msg.audioMessage    ? 'audio'     :
      msg.videoMessage    ? 'video'     :
      msg.documentMessage ? 'documento' :
      msg.stickerMessage  ? 'sticker'   :
      null

    // URL da mídia (campo url direto da Evolution API)
    const urlMidia: string | null =
      msg.imageMessage?.url    ??
      msg.audioMessage?.url    ??
      msg.videoMessage?.url    ??
      msg.documentMessage?.url ??
      msg.stickerMessage?.url  ??
      null

    const nomeArquivo: string | null =
      msg.documentMessage?.fileName ??
      msg.audioMessage?.fileName    ??
      null

    const timestamp = new Date(
      (data?.messageTimestamp ?? Date.now() / 1000) * 1000
    ).toISOString()

    const novaMensagem: Record<string, unknown> = {
      texto: texto || (tipoMidia ? `[${tipoMidia}]` : '[mensagem]'),
      timestamp,
      de: nome,
      ...(tipoMidia ? { tipo_midia: tipoMidia } : {}),
      ...(urlMidia  ? { url_midia: urlMidia }   : {}),
      ...(nomeArquivo ? { nome_arquivo: nomeArquivo } : {}),
    }

    const supabase = createAdminClient()

    // Busca atendimento existente por JID ou telefone
    const orFiltros = [`whatsapp_jid.eq.${jid}`, `whatsapp_jid.eq.${whatsappJidEnvio}`]
    if (telefone) {
      orFiltros.push(`telefone.eq.${telefone}`)
      if (telefone.startsWith('55')) {
        orFiltros.push(`telefone.eq.${telefone.slice(2)}`)
      } else {
        orFiltros.push(`telefone.eq.55${telefone}`)
      }
    }

    const { data: existente } = await supabase
      .from('atendimentos_whatsapp')
      .select('id, mensagens, telefone, whatsapp_jid')
      .or(orFiltros.join(','))
      .neq('coluna', 'finalizado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existente) {
      const mensagens = Array.isArray(existente.mensagens) ? existente.mensagens : []
      const updatePayload: Record<string, unknown> = {
        mensagens: [...mensagens, novaMensagem],
        ultima_mensagem: novaMensagem.texto,
        ultimo_contato: timestamp,
        nao_lido: true,
      }
      // Salva telefone/jid se estavam null
      if (telefone && !existente.telefone) updatePayload.telefone = telefone
      if (!existente.whatsapp_jid) updatePayload.whatsapp_jid = whatsappJidEnvio

      await supabase
        .from('atendimentos_whatsapp')
        .update(updatePayload)
        .eq('id', existente.id)
    } else {
      await supabase.from('atendimentos_whatsapp').insert({
        nome,
        telefone,
        whatsapp_jid: whatsappJidEnvio,
        assunto: (texto || tipoMidia || '').slice(0, 200),
        coluna: 'novo',
        mensagens: [novaMensagem],
        ultima_mensagem: novaMensagem.texto,
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
