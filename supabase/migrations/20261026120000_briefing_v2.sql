-- ============================================================
-- Briefing v2: mais dados da marca, links, uploads (Storage) e
-- acesso de leitura restrito a administradores.
-- Projeto Supabase: simple-design (ztfxcbderlaypgipgpje)
-- ============================================================

-- 1) Administradores ------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- sem policies: a tabela só é gerenciada pelo SQL editor / service role.
-- Para dar acesso ao painel a outra pessoa (depois que ela tiver conta):
--   insert into public.admin_users (user_id)
--   select id from auth.users where email = 'email@dela.com';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

insert into public.admin_users (user_id)
select id from auth.users where email = 'thiago1miedes@gmail.com'
on conflict do nothing;

-- 2) Novas colunas em briefings ------------------------------------
alter table public.briefings
  -- sobre você
  add column if not exists cargo                   text,
  add column if not exists contato_preferido       text,
  add column if not exists como_conheceu           text,
  -- empresa
  add column if not exists segmento                text,
  add column if not exists cidade                  text,
  add column if not exists tempo_mercado           text,
  add column if not exists tamanho_equipe          text,
  add column if not exists descricao_negocio       text,
  add column if not exists produtos_servicos       text,
  add column if not exists publico_alvo            text,
  add column if not exists diferenciais            text,
  add column if not exists concorrentes            text,
  add column if not exists missao_valores          text,
  -- presença online
  add column if not exists link_site               text,
  add column if not exists link_instagram          text,
  add column if not exists link_facebook           text,
  add column if not exists link_tiktok             text,
  add column if not exists link_linkedin           text,
  add column if not exists link_youtube            text,
  add column if not exists link_outros             text,
  -- marca atual
  add column if not exists marca_situacao          text,
  add column if not exists marca_slogan            text,
  add column if not exists marca_gosta             text,
  add column if not exists marca_nao_gosta         text,
  add column if not exists marca_manter            text,
  add column if not exists marca_cores             text,
  add column if not exists marca_fontes            text,
  add column if not exists marca_manual            text,
  -- site
  add column if not exists site_tipo               text,
  add column if not exists site_funcionalidades    text,
  add column if not exists site_tem_conteudo       text,
  add column if not exists site_dominio            text,
  -- identidade
  add column if not exists id_nome_definido        text,
  add column if not exists id_entregaveis          text,
  add column if not exists id_evitar               text,
  -- redes sociais
  add column if not exists social_servicos         text,
  add column if not exists social_seguidores       text,
  add column if not exists social_quem_publica     text,
  add column if not exists social_conteudo_proprio text,
  -- geral / arquivos
  add column if not exists prazo_geral             text,
  add column if not exists referencias_links       text,
  add column if not exists arquivos_link           text,
  add column if not exists arquivos                jsonb not null default '[]'::jsonb;

alter table public.briefings drop constraint if exists briefings_arquivos_array;
alter table public.briefings
  add constraint briefings_arquivos_array
  check (jsonb_typeof(arquivos) = 'array' and jsonb_array_length(arquivos) <= 60);

-- 3) Policies: briefings -------------------------------------------
drop policy if exists "Anyone can insert briefings" on public.briefings;
drop policy if exists "Authenticated users can read briefings" on public.briefings;
drop policy if exists "Authenticated users can update briefings" on public.briefings;
drop policy if exists briefings_insert_publico on public.briefings;
drop policy if exists briefings_select_admin on public.briefings;
drop policy if exists briefings_update_admin on public.briefings;

create policy briefings_insert_publico on public.briefings
  for insert to anon, authenticated
  with check (coalesce(status, 'novo') = 'novo');

create policy briefings_select_admin on public.briefings
  for select to authenticated
  using ((select public.is_admin()));

create policy briefings_update_admin on public.briefings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 4) Policies: contatos (admin lê e agora também atualiza status) ---
drop policy if exists select_autenticado_contato on public.contatos;
drop policy if exists contatos_select_admin on public.contatos;
drop policy if exists contatos_update_admin on public.contatos;

create policy contatos_select_admin on public.contatos
  for select to authenticated
  using ((select public.is_admin()));

create policy contatos_update_admin on public.contatos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 5) Storage: bucket privado, 8MB por arquivo -----------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'briefing-arquivos', 'briefing-arquivos', false, 8388608,
  array[
    'image/png','image/jpeg','image/webp','image/gif','image/svg+xml',
    'image/heic','image/heif','image/avif','image/tiff','image/vnd.adobe.photoshop',
    'application/pdf','application/postscript','application/illustrator','application/x-coreldraw',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'video/mp4','video/quicktime'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists briefing_arquivos_insert_publico on storage.objects;
drop policy if exists briefing_arquivos_select_admin on storage.objects;

-- qualquer visitante pode ENVIAR (nunca ler/listar/sobrescrever),
-- sempre dentro de uma pasta com o UUID do briefing
create policy briefing_arquivos_insert_publico on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'briefing-arquivos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- só administradores leem (signed URLs no painel)
create policy briefing_arquivos_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'briefing-arquivos' and (select public.is_admin()));
