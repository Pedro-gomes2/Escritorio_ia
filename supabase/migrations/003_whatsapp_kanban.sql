CREATE TABLE IF NOT EXISTS atendimentos_whatsapp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  telefone text,
  assunto text,
  coluna text DEFAULT 'novo' CHECK (coluna IN ('novo','atendendo','aguardando','finalizado')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE atendimentos_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON atendimentos_whatsapp
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
