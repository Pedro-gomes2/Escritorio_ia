import { createClient } from '@/lib/supabase/server'
import AssistenteChat from './_chat'

export default async function AssistentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: conversas }, { data: documentos }] = await Promise.all([
    supabase.from('conversas_ia')
      .select('id, titulo, documento_id, created_at')
      .eq('usuario_id', user?.id)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase.from('documentos')
      .select('id, nome, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <AssistenteChat
      userId={user?.id ?? ''}
      conversasIniciais={conversas ?? []}
      documentosDisponiveis={documentos ?? []}
    />
  )
}
