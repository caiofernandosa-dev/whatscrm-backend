-- ============================================
-- WHATSCRM - Script do Banco de Dados
-- Cole isso no Supabase → SQL Editor → Run
-- ============================================

-- Tabela de contatos
create table if not exists contatos (
  id                  uuid default gen_random_uuid() primary key,
  nome                text,
  telefone            text not null unique,
  tag                 text,
  segmento            text,         -- 'clinica', 'advocacia', 'ecommerce', etc
  prompt_personalizado text,        -- prompt customizado para este contato
  ia_ativa            boolean default true,
  ativo               boolean default true,
  remarketing_ativo   boolean default true,
  ultima_interacao    timestamp,
  criado_em           timestamp default now()
);

-- Tabela de mensagens (histórico de conversas)
create table if not exists mensagens (
  id          uuid default gen_random_uuid() primary key,
  contato_id  uuid references contatos(id) on delete cascade,
  role        text not null,        -- 'user' ou 'assistant'
  conteudo    text not null,
  criado_em   timestamp default now()
);

-- Tabela de campanhas (disparos em massa)
create table if not exists campanhas (
  id              uuid default gen_random_uuid() primary key,
  nome            text not null,
  mensagem        text not null,
  segmento        text,
  tag             text,
  status          text default 'rascunho', -- 'rascunho', 'agendada', 'enviando', 'concluida'
  total_contatos  int default 0,
  total_enviados  int default 0,
  total_falhas    int default 0,
  agendado_para   timestamp,
  concluido_em    timestamp,
  criado_em       timestamp default now()
);

-- Tabela de agendamentos (clínica e advocacia)
create table if not exists agendamentos (
  id               uuid default gen_random_uuid() primary key,
  contato_id       uuid references contatos(id) on delete cascade,
  data_hora        timestamp not null,
  tipo             text,            -- 'consulta', 'retorno', 'reuniao', etc
  segmento         text,            -- 'clinica', 'advocacia'
  profissional     text,
  observacoes      text,
  status           text default 'confirmado', -- 'confirmado', 'cancelado', 'realizado'
  lembrete_enviado boolean default false,
  criado_em        timestamp default now()
);

-- Índices para performance
create index if not exists idx_contatos_telefone   on contatos(telefone);
create index if not exists idx_contatos_segmento   on contatos(segmento);
create index if not exists idx_mensagens_contato   on mensagens(contato_id);
create index if not exists idx_agendamentos_data   on agendamentos(data_hora);
create index if not exists idx_agendamentos_status on agendamentos(status);

-- Dados de exemplo para testar
insert into contatos (nome, telefone, tag, segmento, ia_ativa) values
  ('Ana Costa',    '67998012233', 'cliente',   'clinica',    true),
  ('Pedro Mota',   '11987125544', 'lead',      'advocacia',  true),
  ('Lúcia Faria',  '21976549910', 'vip',       'ecommerce',  true),
  ('Rafael Souza', '31965437788', 'inativo',   'clinica',    false)
on conflict do nothing;
