-- Migration 008: Módulo CNIS Previdenciário

-- Extratos do CNIS importados por cliente
CREATE TABLE IF NOT EXISTS cnis_extratos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES profiles(id),
  nome_segurado text,
  cpf text,
  data_nascimento date,
  sexo text CHECK (sexo IN ('M', 'F')),
  -- Resultado do processamento
  total_competencias int DEFAULT 0,
  total_vinculos int DEFAULT 0,
  primeira_competencia text,  -- formato MM/AAAA
  ultima_competencia text,
  -- Arquivo original
  arquivo_nome text,
  arquivo_tipo text CHECK (arquivo_tipo IN ('pdf', 'xml')),
  -- Dados brutos extraídos (JSON completo)
  dados_raw jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Competências individuais do CNIS (cada linha = 1 mês de contribuição)
CREATE TABLE IF NOT EXISTS cnis_competencias (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  extrato_id uuid REFERENCES cnis_extratos(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
  -- Identificação
  competencia text NOT NULL,       -- formato MM/AAAA ex: 01/2020
  ano int NOT NULL,
  mes int NOT NULL,
  -- Vínculo
  empregador text,
  cnpj_empregador text,
  tipo_filiacao text,              -- Empregado, Contribuinte Individual, MEI, etc
  -- Valores
  remuneracao numeric(12,2),
  contribuicao numeric(12,2),
  -- Flags
  indicador_contribuicao text,     -- A = aceita, I = ignorada, etc
  carencia boolean DEFAULT true,   -- conta para carência
  created_at timestamptz DEFAULT now()
);

-- Simulações salvas por cliente
CREATE TABLE IF NOT EXISTS previdencia_simulacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
  extrato_id uuid REFERENCES cnis_extratos(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES profiles(id),
  nome text NOT NULL DEFAULT 'Simulação',
  -- Parâmetros
  data_calculo date NOT NULL,
  regime text DEFAULT 'RGPS',    -- RGPS ou RPPS
  -- Resultado calculado (JSON com todas as regras)
  resultado jsonb,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE cnis_extratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnis_competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE previdencia_simulacoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cnis_extratos' AND policyname='auth_all_cnis_extratos') THEN
    CREATE POLICY "auth_all_cnis_extratos" ON cnis_extratos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cnis_competencias' AND policyname='auth_all_cnis_competencias') THEN
    CREATE POLICY "auth_all_cnis_competencias" ON cnis_competencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='previdencia_simulacoes' AND policyname='auth_all_simulacoes') THEN
    CREATE POLICY "auth_all_simulacoes" ON previdencia_simulacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Index para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_cnis_extratos_cliente ON cnis_extratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cnis_competencias_extrato ON cnis_competencias(extrato_id);
CREATE INDEX IF NOT EXISTS idx_cnis_competencias_ano ON cnis_competencias(extrato_id, ano, mes);
CREATE INDEX IF NOT EXISTS idx_simulacoes_cliente ON previdencia_simulacoes(cliente_id);
