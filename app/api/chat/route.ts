import { anthropic, SYSTEM_PROMPT } from '@/lib/claude'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { messages, documentoId, conversaId } = await request.json()

    if (!messages?.length) {
      return NextResponse.json({ error: 'Nenhuma mensagem enviada' }, { status: 400 })
    }

    let systemPrompt = SYSTEM_PROMPT

    if (documentoId) {
      const { data: doc } = await supabase
        .from('documentos')
        .select('nome, texto_extraido')
        .eq('id', documentoId)
        .single()

      if (doc?.texto_extraido) {
        systemPrompt += `\n\n---\nDOCUMENTO EM ANÁLISE: "${doc.nome}"\n\n${doc.texto_extraido.slice(0, 80000)}\n---`
      }
    }

    // Envia apenas role + content para a API (sem timestamp)
    const apiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = ''
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              fullText += text
              controller.enqueue(encoder.encode(text))
            }
          }
        } finally {
          controller.close()
        }

        // Salva conversa no banco após stream terminar
        if (conversaId && fullText) {
          const newMessages = [
            ...messages,
            { role: 'assistant', content: fullText, timestamp: new Date().toISOString() },
          ]
          await supabase.from('conversas_ia')
            .update({ mensagens: newMessages, updated_at: new Date().toISOString() })
            .eq('id', conversaId)
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })

  } catch (error: unknown) {
    console.error('[chat/route]', error)
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
