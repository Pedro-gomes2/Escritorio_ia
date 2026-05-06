-- Perfis de usuário (estende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL,
  cargo TEXT CHECK (cargo IN ('socio', 'advogado', 'estagiario')) DEFAULT 'advogado',
  oab TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: cria profile automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('pf', 'pj')) DEFAULT 'pf',
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Processos judiciais
CREATE TABLE IF NOT EXISTS processos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT,
  titulo TEXT NOT NULL,
  tipo TEXT,
  vara TEXT,
  comarca TEXT,
  fase TEXT,
  status TEXT CHECK (status IN ('ativo', 'suspenso', 'arquivado', 'encerrado')) DEFAULT 'ativo',
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  advogado_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  valor_causa NUMERIC,
  prazo_proximo TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Movimentações do processo
CREATE TABLE IF NOT EXISTS movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES processos(id) ON DELETE CASCADE NOT NULL,
  data TIMESTAMPTZ DEFAULT now(),
  tipo TEXT,
  descricao TEXT NOT NULL,
  autor_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Tarefas (Kanban)
CREATE TABLE IF NOT EXISTS tarefas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  processo_id UUID REFERENCES processos(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  prioridade TEXT CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')) DEFAULT 'media',
  status TEXT CHECK (status IN ('pendente', 'em_andamento', 'revisao', 'concluida')) DEFAULT 'pendente',
  prazo TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documentos
CREATE TABLE IF NOT EXISTS documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  texto_extraido TEXT,
  processo_id UUID REFERENCES processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  uploader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversas com a IA
CREATE TABLE IF NOT EXISTS conversas_ia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  documento_id UUID REFERENCES documentos(id) ON DELETE SET NULL,
  titulo TEXT DEFAULT 'Nova conversa',
  mensagens JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Honorários
CREATE TABLE IF NOT EXISTS honorarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  processo_id UUID REFERENCES processos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  tipo TEXT CHECK (tipo IN ('fixo', 'exito', 'hora', 'mensal')) DEFAULT 'fixo',
  status TEXT CHECK (status IN ('pendente', 'pago', 'cancelado')) DEFAULT 'pendente',
  vencimento TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: habilitar para todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE honorarios ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados têm acesso total (escritório pequeno)
CREATE POLICY "auth_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON processos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON tarefas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON honorarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Conversas: cada usuário vê apenas as suas
CREATE POLICY "own_conversas" ON conversas_ia FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- Storage bucket para documentos
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false) ON CONFLICT DO NOTHING;
CREATE POLICY "auth_storage" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'documentos');
