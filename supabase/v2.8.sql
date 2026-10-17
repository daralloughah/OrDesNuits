-- =========================================================
-- OrDesNuits · migration v2.8 : entonnoir de conversion
-- Compteurs anonymes par jour (aucune donnée personnelle,
-- aucun cookie) : visites → fiches produit → panier →
-- commande commencée → commande passée.
-- Peut être relancé sans risque.
-- =========================================================
create table if not exists public.events_daily (
  day date not null,
  name text not null,
  n integer not null default 0,
  primary key (day, name)
);
alter table public.events_daily enable row level security;
drop policy if exists "stats: gérant" on public.events_daily;
create policy "stats: gérant" on public.events_daily for select using (public.is_admin());
grant select on public.events_daily to authenticated;

create or replace function public.track(p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_name not in ('visit', 'product', 'cart', 'checkout', 'order') then return; end if;
  insert into public.events_daily (day, name, n) values (current_date, p_name, 1)
  on conflict (day, name) do update set n = public.events_daily.n + 1;
end $$;
grant execute on function public.track(text) to anon, authenticated;

-- Pour le dossier investisseur (même jeton que investor_snapshot)
create or replace function public.investor_funnel(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_tok text;
begin
  select value->>'token' into v_tok from public.settings where key = 'investor';
  if v_tok is null or length(v_tok) < 24 or p_token is distinct from v_tok then raise exception 'forbidden'; end if;
  return (select coalesce(jsonb_object_agg(name, n), '{}') from (
    select name, sum(n) as n from public.events_daily where day > current_date - 30 group by name) x);
end $$;
grant execute on function public.investor_funnel(text) to anon, authenticated;
