import { createClient } from '@/lib/supabase/server'
import { extractTextFromPDF } from '@/lib/pdf'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const processoId = formData.get('processo_id') as string | null
  const clienteId = formData.get('cliente_id') as string | null

  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const storagePath = `${user.id}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(storagePath, buffer, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: 'Erro no upload' }, { status: 500 })

  let textoExtraido: string | null = null
  if (file.type === 'application/pdf') {
    try {
      textoExtraido = await extractTextFromPDF(buffer)
    } catch {
      textoExtraido = null
    }
  }

  const { data: documento, error: dbError } = await supabase
    .from('documentos')
    .insert({
      nome: file.name,
      storage_path: storagePath,
      texto_extraido: textoExtraido,
      processo_id: processoId || null,
      cliente_id: clienteId || null,
      uploader_id: user.id,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })

  return NextResponse.json({ documento })
}
