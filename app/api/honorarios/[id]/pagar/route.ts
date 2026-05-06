import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await supabase.from('honorarios')
    .update({ status: 'pago', pago_em: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.redirect(new URL('/financeiro', request.url))
}
