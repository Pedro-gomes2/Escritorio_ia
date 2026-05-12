-- Migration 007: Caminho da pasta física por cliente
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS pasta_path TEXT;
