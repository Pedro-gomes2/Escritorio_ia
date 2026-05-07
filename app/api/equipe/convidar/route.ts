import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Verifica se quem está chamando é um usuário autenticado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { nome, email, senha, cargo, oab } = await request.json()

  if (!nome || !email || !senha) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Cria o usuário no Supabase Auth
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // já confirma o e-mail automaticamente
    user_metadata: { nome },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Atualiza o perfil com cargo e OAB (o trigger já criou o registro base)
  if (newUser.user) {
    await admin.from('profiles').update({
      nome,
      cargo: cargo || 'advogado',
      oab: oab || null,
    }).eq('id', newUser.user.id)
  }

  return NextResponse.json({ ok: true })
}
