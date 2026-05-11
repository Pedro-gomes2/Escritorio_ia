-- Adiciona colunas para integração Evolution API
ALTER TABLE atendimentos_whatsapp
  ADD COLUMN IF NOT EXISTS whatsapp_jid text,
  ADD COLUMN IF NOT EXISTS mensagens jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ultima_mensagem text,
  ADD COLUMN IF NOT EXISTS ultimo_contato timestamptz DEFAULT now();

-- Realtime: habilita para a tabela (necessário para atualização automática no kanban)
ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos_whatsapp;
