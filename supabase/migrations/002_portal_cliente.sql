-- Adiciona token de acesso ao portal do cliente
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS token_portal UUID DEFAULT gen_random_uuid() UNIQUE;

-- Atualiza clientes existentes que não tenham token
UPDATE clientes SET token_portal = gen_random_uuid() WHERE token_portal IS NULL;

-- Política pública: qualquer pessoa com o token pode ler dados do portal
CREATE POLICY "portal_cliente_by_token" ON clientes
  FOR SELECT TO anon
  USING (token_portal IS NOT NULL);

CREATE POLICY "portal_processos" ON processos
  FOR SELECT TO anon
  USING (
    cliente_id IN (SELECT id FROM clientes WHERE token_portal IS NOT NULL)
  );

CREATE POLICY "portal_movimentacoes" ON movimentacoes
  FOR SELECT TO anon
  USING (
    processo_id IN (
      SELECT p.id FROM processos p
      INNER JOIN clientes c ON c.id = p.cliente_id
      WHERE c.token_portal IS NOT NULL
    )
  );
