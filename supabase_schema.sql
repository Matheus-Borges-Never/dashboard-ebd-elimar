-- EBD Elimar — Schema Supabase
-- Cole no SQL Editor do Supabase e execute

create table if not exists trimestres (
  id text primary key,
  nome text not null,
  inicio date not null,
  fim date not null,
  ativo boolean not null default false
);

create table if not exists salas (
  id text primary key,
  nome text not null,
  trimestre_id text not null references trimestres(id) on delete cascade
);

create table if not exists alunos (
  id text primary key,
  nome text not null,
  sala_id text not null references salas(id) on delete cascade
);

create table if not exists presencas (
  aluno_id text not null references alunos(id) on delete cascade,
  data date not null,
  presente boolean not null default false,
  primary key (aluno_id, data)
);

-- Desativa RLS (acesso via service_role key pelo backend)
alter table trimestres disable row level security;
alter table salas disable row level security;
alter table alunos disable row level security;
alter table presencas disable row level security;
