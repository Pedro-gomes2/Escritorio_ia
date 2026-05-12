-- Migration 006: WhatsApp CRM melhorias

-- Remove CHECK constraint do campo coluna para permitir colunas customizadas
ALTER TABLE atendimentos_whatsapp DROP CONSTRAINT IF EXISTS atendimentos_whatsapp_coluna_check;

-- Tabela de colunas kanban customizáveis
CREATE TABLE IF NOT EXISTS kanban_colunas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT 'slate',
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Insere as 4 colunas padrão (correspondendo aos valores já no banco)
INSERT INTO kanban_colunas (chave, nome, cor, ordem) VALUES
  ('novo', 'Novo Contato', 'yellow', 0),
  ('atendendo', 'Em Atendimento', 'blue', 1),
  ('aguardando', 'Aguardando Cliente', 'orange', 2),
  ('finalizado', 'Finalizado', 'green', 3)
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE kanban_colunas ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "auth_all_colunas" ON kanban_colunas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Adiciona notas internas e marcador de não lido
ALTER TABLE atendimentos_whatsapp
  ADD COLUMN IF NOT EXISTS nao_lido boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas text;

-- Tabela de mensagens agendadas
CREATE TABLE IF NOT EXISTS mensagens_agendadas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id uuid REFERENCES atendimentos_whatsapp(id) ON DELETE CASCADE,
  mensagem text NOT NULL,
  enviar_em timestamptz NOT NULL,
  enviado boolean DEFAULT false,
  enviado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mensagens_agendadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "auth_all_agendadas" ON mensagens_agendadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
