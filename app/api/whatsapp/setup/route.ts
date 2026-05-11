import { NextRequest, NextResponse } from 'next/server'

const EVO_URL = process.env.EVOLUTION_API_URL!
const EVO_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = process.env.EVOLUTION_INSTANCE!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

function evoHeaders() {
  return { 'Content-Type': 'application/json', apikey: EVO_KEY }
}

// GET → retorna status da instância e QR code se necessário
export async function GET() {
  try {
    // Tenta buscar instâncias existentes
    const resStatus = await fetch(`${EVO_URL}/instance/fetchInstances`, {
      headers: evoHeaders(),
    })
    const instances = await resStatus.json()
    const instancia = Array.isArray(instances)
      ? instances.find((i: { instance: { instanceName: string } }) => i.instance?.instanceName === INSTANCE)
      : null

    if (!instancia) {
      // Cria a instância
      await fetch(`${EVO_URL}/instance/create`, {
        method: 'POST',
        headers: evoHeaders(),
        body: JSON.stringify({
          instanceName: INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      })
    }

    // Configura o webhook
    await fetch(`${EVO_URL}/webhook/set/${INSTANCE}`, {
      method: 'POST',
      headers: evoHeaders(),
      body: JSON.stringify({
        url: `${APP_URL}/api/whatsapp/webhook`,
        webhook_by_events: false,
        webhook_base64: false,
        events: ['MESSAGES_UPSERT'],
      }),
    })

    // Busca o QR code / status de conexão
    const resConnect = await fetch(`${EVO_URL}/instance/connect/${INSTANCE}`, {
      headers: evoHeaders(),
    })
    const connectData = await resConnect.json()

    return NextResponse.json(connectData)
  } catch (err) {
    console.error('Erro setup Evolution API:', err)
    return NextResponse.json({ error: 'Erro ao conectar Evolution API' }, { status: 500 })
  }
}

// POST → desconecta / logout
export async function POST(req: NextRequest) {
  const { action } = await req.json()
  if (action === 'logout') {
    await fetch(`${EVO_URL}/instance/logout/${INSTANCE}`, {
      method: 'DELETE',
      headers: evoHeaders(),
    })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
}
