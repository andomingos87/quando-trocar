-- ============================================================================
-- Cadastro completo da oficina (revisao das telas /admin/oficinas)
--
-- Objetivo:
--   Superficie de cadastro no painel admin passa a cobrir os dados fiscais e de
--   contato que o banco ja precisava (cpf_cnpj/asaas_customer_id ja existiam mas
--   nao tinham campo na UI) e que a cobranca ASAAS exige, alem de endereco,
--   e-mail e observacao livre.
--
--   O bloqueio real: sem `cpf_cnpj` a geracao de cobranca ASAAS sempre retorna
--   `missing_cpf_cnpj` (lib/admin/billing.ts). Nao havia campo para preencher.
--
-- Aditiva e reversivel: apenas colunas novas, todas NULL-aveis. Nada e removido.
-- ============================================================================

alter table oficinas
  add column if not exists email text,          -- contato/entrega de fatura (ASAAS)
  add column if not exists cep text,            -- so digitos ou 00000-000; normalizado na app
  add column if not exists estado text,         -- UF (2 letras), maiusculo
  add column if not exists bairro text,
  add column if not exists logradouro text,     -- rua/avenida
  add column if not exists numero text,         -- texto: aceita "s/n", "123-A"
  add column if not exists complemento text,
  add column if not exists observacao text;     -- nota livre do admin (antes era descartada)

comment on column oficinas.cpf_cnpj is 'Documento fiscal (CPF ou CNPJ). Obrigatorio para cobranca via ASAAS.';
comment on column oficinas.email is 'E-mail de contato/entrega de fatura.';
comment on column oficinas.observacao is 'Anotacao livre do admin sobre a oficina.';
