import { genAI, SYSTEM_PROMPT } from '@/lib/gemini'
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

    // Separa o histórico da última mensagem do usuário
    const historico = messages.slice(0, -1)
    const ultimaMensagem = messages[messages.length - 1]

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt,
    })

    const chat = model.startChat({
      history: historico.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    })

    const result = await chat.sendMessageStream(ultimaMensagem.content)

    const encoder = new TextEncoder()
    let fullText = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              fullText += text
              controller.enqueue(encoder.encode(text))
            }
          }
        } catch (streamErr) {
          console.error('[stream error]', streamErr)
        } finally {
          controller.close()
        }

        // Salva conversa no banco
        if (conversaId && fullText) {
          try {
            const newMessages = [
              ...messages,
              { role: 'assistant', content: fullText, timestamp: new Date().toISOString() },
            ]
            await supabase
              .from('conversas_ia')
              .update({ mensagens: newMessages, updated_at: new Date().toISOString() })
              .eq('id', conversaId)
          } catch (dbErr) {
            console.error('[db save error]', dbErr)
          }
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })

  } catch (error: unknown) {
    console.error('[chat/route error]', error)
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
