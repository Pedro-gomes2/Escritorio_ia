import { anthropic, SYSTEM_PROMPT } from '@/lib/claude'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { messages, documentoId, conversaId } = await request.json()

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

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let fullText = ''
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          fullText += text
          controller.enqueue(encoder.encode(text))
        }
      }
      controller.close()

      if (conversaId) {
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
}
