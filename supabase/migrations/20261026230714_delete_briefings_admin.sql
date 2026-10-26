-- Permite que somente administradores removam briefings e anexos do bucket privado.
-- A policy de SELECT em briefings também é exigida para retornar a linha excluída.

grant delete on table public.briefings to authenticated;

drop policy if exists briefings_delete_admin on public.briefings;
create policy briefings_delete_admin on public.briefings
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists briefing_arquivos_delete_admin on storage.objects;
create policy briefing_arquivos_delete_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'briefing-arquivos'
    and (select public.is_admin())
  );
