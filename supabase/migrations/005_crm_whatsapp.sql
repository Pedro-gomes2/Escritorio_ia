-- Migration 005: CRM WhatsApp features

-- Adiciona colunas de CRM na tabela existente
ALTER TABLE atendimentos_whatsapp
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lembrete timestamptz,
  ADD COLUMN IF NOT EXISTS responsavel text;

-- Tabela de respostas rápidas
CREATE TABLE IF NOT EXISTS respostas_rapidas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE respostas_rapidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON respostas_rapidas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
