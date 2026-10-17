-- =========================================================
-- OrDesNuits · migration v2.4
-- Affiliés, codes promo d'audience, livraison offerte dès X €,
-- option « Offrir », avis vérifiés, paniers en attente,
-- compteur public, dossier investisseur, espace partenaire.
-- Peut être relancé sans risque (idempotent).
-- =========================================================

-- ---------- Affiliés (réservé au gérant) ----------
create table if not exists public.affiliates (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.affiliates enable row level security;
drop policy if exists "affiliés: admin" on public.affiliates;
create policy "affiliés: admin" on public.affiliates for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.affiliates to authenticated;

-- ---------- Réglages de la boutique (livraison, cadeau) ----------
insert into public.settings (key, value) values ('shop', '{"ship_fee": 5.90, "free_from": 49, "gift_fee": 3.90}') on conflict (key) do nothing;
drop policy if exists "réglages: lecture" on public.settings;
create policy "réglages: lecture" on public.settings for select using (key in ('offer', 'shop') or public.is_admin());

-- ---------- Avis vérifiés (uniquement des clients livrés) ----------
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  order_id text not null unique references public.orders on delete cascade,
  product_id text,
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 3 and 600),
  name text not null default '',
  lang text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
drop policy if exists "avis: lecture publique" on public.reviews;
create policy "avis: lecture publique" on public.reviews for select using (approved or public.is_admin());
drop policy if exists "avis: admin" on public.reviews;
create policy "avis: admin" on public.reviews for all using (public.is_admin()) with check (public.is_admin());
grant select on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;

-- Un client connecté laisse un avis sur une de SES commandes livrées
create or replace function public.submit_review(p_order text, p_product text, p_rating int, p_body text, p_name text, p_lang text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_o public.orders;
begin
  select * into v_o from public.orders where id = p_order and status = 'livree'
    and (user_id = auth.uid() or lower(customer->>'email') = lower(coalesce(auth.jwt()->>'email', '')));
  if not found then raise exception 'not_allowed'; end if;
  insert into public.reviews (order_id, product_id, rating, body, name, lang)
  values (p_order, left(p_product, 80), greatest(1, least(5, p_rating)), left(trim(p_body), 600), left(trim(coalesce(p_name, '')), 40), left(p_lang, 10))
  on conflict (order_id) do update set rating = excluded.rating, body = excluded.body, name = excluded.name, approved = false;
  return true;
end $$;
revoke all on function public.submit_review(text, text, int, text, text, text) from public;
grant execute on function public.submit_review(text, text, int, text, text, text) to authenticated;

-- ---------- Paniers en attente (seulement avec accord du client) ----------
create table if not exists public.carts (
  email text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.carts enable row level security;
drop policy if exists "paniers: admin" on public.carts;
create policy "paniers: admin" on public.carts for all using (public.is_admin()) with check (public.is_admin());
grant select, delete on public.carts to authenticated;

create or replace function public.save_cart(p jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p->>'email'));
begin
  if coalesce((p->>'optin')::boolean, false) is not true then return false; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then return false; end if;
  if jsonb_array_length(coalesce(p->'lines', '[]')) = 0 or jsonb_array_length(p->'lines') > 30 then return false; end if;
  insert into public.carts (email, data, updated_at)
  values (v_email, jsonb_build_object('firstName', left(p->>'firstName', 80), 'phone', left(p->>'phone', 40), 'lang', left(p->>'lang', 10),
                                      'lines', p->'lines', 'total', left(p->>'total', 40)), now())
  on conflict (email) do update set data = excluded.data, updated_at = now();
  return true;
end $$;
grant execute on function public.save_cart(jsonb) to anon, authenticated;

-- ---------- Code promo d'audience d'un affilié (lecture publique du % seulement) ----------
create or replace function public.check_promo(p_code text)
returns numeric language sql stable security definer set search_path = public as $$
  select least(30, greatest(0, coalesce((data->>'promoPct')::numeric, 0)))
  from public.affiliates where id = upper(trim(p_code)) and data->>'status' = 'actif' limit 1;
$$;
grant execute on function public.check_promo(text) to anon, authenticated;

-- ---------- Compteur public (commandes expédiées) ----------
create or replace function public.public_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('shipped', count(*) filter (where status in ('expediee', 'livree') and not demo),
                            'rating', (select round(avg(rating)::numeric, 1) from public.reviews where approved),
                            'reviews', (select count(*) from public.reviews where approved))
  from public.orders;
$$;
grant execute on function public.public_stats() to anon, authenticated;

-- ---------- Commande : livraison, cadeau, code promo ----------
create or replace function public.place_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_line jsonb; v_prod public.products; v_qty int; v_unit numeric; v_total numeric;
  v_lines jsonb := '[]'; v_units numeric[] := '{}'; v_sub numeric := 0; v_disc numeric := 0;
  v_free int; v_offer jsonb; v_shop jsonb; v_id text; v_email text := lower(trim(p->'customer'->>'email'));
  v_code text := upper(trim(coalesce(p->>'promo', ''))); v_pct numeric := 0; v_promo numeric := 0;
  v_ship numeric := 0; v_gift numeric := 0; v_display jsonb := coalesce(p->'display', '{}');
begin
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'email'; end if;
  if jsonb_array_length(coalesce(p->'lines', '[]')) = 0 or jsonb_array_length(p->'lines') > 30 then raise exception 'lines'; end if;

  for v_line in select * from jsonb_array_elements(p->'lines') loop
    v_qty := greatest(1, least(500, coalesce((v_line->>'qty')::int, 1)));
    select * into v_prod from public.products where id = v_line->>'id' and active;
    if not found then raise exception 'product:%', v_line->>'id'; end if;
    if v_prod.stock <= 0 then raise exception 'sold_out:%', v_prod.name; end if;
    v_unit := case when v_prod.promo is not null and v_prod.promo < v_prod.price then v_prod.promo else v_prod.price end;
    v_total := public.best_cost(v_prod.extra->'tiers', v_unit, v_qty);
    v_sub := v_sub + v_total;
    v_lines := v_lines || jsonb_build_object('id', v_prod.id, 'name', v_prod.name, 'qty', v_qty, 'unitEur', round(v_total / v_qty, 4),
                                             'lineEur', v_total, 'shop', v_prod.shop, 'category', v_prod.category);
    if v_prod.offer then
      for i in 1..v_qty loop v_units := v_units || round(v_total / v_qty, 4); end loop;
    end if;
  end loop;

  select value into v_offer from public.settings where key = 'offer';
  if coalesce((v_offer->>'active')::boolean, false) then
    v_free := floor(coalesce(array_length(v_units, 1), 0) / (coalesce((v_offer->>'buy')::int, 3) + 1));
    select coalesce(sum(u), 0) into v_disc from (select unnest(v_units) u order by 1 limit v_free) s;
  end if;

  -- code promo d'un affilié actif
  if v_code <> '' then
    v_pct := coalesce(public.check_promo(v_code), 0);
    if v_pct > 0 then
      v_promo := round((v_sub - v_disc) * v_pct / 100, 2);
      v_display := v_display || jsonb_build_object('ref', v_code, 'promo', v_code, 'promoPct', v_pct);
    end if;
  end if;
  v_disc := round(v_disc + v_promo, 2);

  -- livraison offerte à partir d'un montant, emballage cadeau en option
  select value into v_shop from public.settings where key = 'shop';
  if v_sub - v_disc < coalesce((v_shop->>'free_from')::numeric, 0) then v_ship := coalesce((v_shop->>'ship_fee')::numeric, 0); end if;
  if coalesce((p->>'gift')::boolean, false) then
    v_gift := coalesce((v_shop->>'gift_fee')::numeric, 0);
    v_display := v_display || jsonb_build_object('gift', true);
  end if;
  v_display := v_display || jsonb_build_object('shipEur', v_ship, 'giftEur', v_gift, 'promoEur', v_promo);

  v_id := 'ODN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.orders (id, user_id, customer, shipping, lang, lines, subtotal_eur, discount_eur, total_eur, display)
  values (
    v_id, auth.uid(),
    jsonb_build_object('email', v_email, 'firstName', left(p->'customer'->>'firstName', 80), 'lastName', left(p->'customer'->>'lastName', 80),
                       'phone', left(p->'customer'->>'phone', 40), 'optin', coalesce((p->'customer'->>'optin')::boolean, false)),
    jsonb_build_object('country', left(p->'shipping'->>'country', 2), 'region', left(p->'shipping'->>'region', 3), 'address', left(p->'shipping'->>'address', 200),
                       'postcode', left(p->'shipping'->>'postcode', 20), 'city', left(p->'shipping'->>'city', 80)),
    left(p->>'lang', 10), v_lines, v_sub, v_disc, v_sub - v_disc + v_ship + v_gift, v_display
  );
  if coalesce((p->'customer'->>'optin')::boolean, false) then
    insert into public.subscribers (email, source, lang) values (v_email, 'commande', left(p->>'lang', 10)) on conflict (email) do nothing;
  end if;
  delete from public.carts where email = v_email;
  return jsonb_build_object('id', v_id, 'lines', v_lines, 'subtotalEur', v_sub, 'discountEur', v_disc, 'promoEur', v_promo,
                            'shipEur', v_ship, 'giftEur', v_gift, 'totalEur', v_sub - v_disc + v_ship + v_gift);
end $$;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- ---------- Espace partenaire : l'affilié connecté voit SES chiffres ----------
create or replace function public.my_affiliate()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_a public.affiliates; v_email text := lower(coalesce(auth.jwt()->>'email', '')); v_res jsonb; v_rank int; v_n int;
begin
  if v_email = '' then return null; end if;
  select * into v_a from public.affiliates where lower(data->>'email') = v_email and data->>'status' <> 'fin' limit 1;
  if not found then return null; end if;
  with s as (
    select o.created_at, (o.subtotal_eur - o.discount_eur) as total_eur from public.orders o
    where upper(o.display->>'ref') = v_a.id and o.status in ('confirmee', 'expediee', 'livree')
  ), ranks as (
    select a.id, (select coalesce(sum(o.subtotal_eur - o.discount_eur), 0) from public.orders o where upper(o.display->>'ref') = a.id
      and o.status in ('confirmee', 'expediee', 'livree') and o.created_at > now() - interval '30 days') as rev
    from public.affiliates a where a.data->>'status' = 'actif'
  )
  select jsonb_build_object(
    'code', v_a.id, 'name', v_a.data->>'name', 'pct', v_a.data->'pct', 'promoPct', v_a.data->'promoPct', 'status', v_a.data->>'status',
    'payouts', coalesce(v_a.data->'payouts', '[]'),
    'week', (select jsonb_build_object('n', count(*), 'rev', coalesce(sum(total_eur), 0)) from s where created_at > now() - interval '7 days'),
    'month', (select jsonb_build_object('n', count(*), 'rev', coalesce(sum(total_eur), 0)) from s where created_at > now() - interval '30 days'),
    'year', (select jsonb_build_object('n', count(*), 'rev', coalesce(sum(total_eur), 0)) from s where created_at > now() - interval '365 days'),
    'total', (select jsonb_build_object('n', count(*), 'rev', coalesce(sum(total_eur), 0)) from s),
    'months', (select coalesce(jsonb_agg(m order by m->>'ym' desc), '[]') from (
        select jsonb_build_object('ym', to_char(date_trunc('month', created_at), 'YYYY-MM'), 'n', count(*), 'rev', sum(total_eur)) m
        from s group by date_trunc('month', created_at) order by date_trunc('month', created_at) desc limit 12) x),
    'rank', (select count(*) + 1 from ranks r where r.rev > (select rev from ranks where id = v_a.id)),
    'of', (select count(*) from ranks)
  ) into v_res;
  return v_res;
end $$;
revoke all on function public.my_affiliate() from public;
grant execute on function public.my_affiliate() to authenticated;

-- ---------- Dossier investisseur : lien privé avec jeton ----------
create or replace function public.investor_snapshot(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_tok text;
begin
  select value->>'token' into v_tok from public.settings where key = 'investor';
  if v_tok is null or length(v_tok) < 24 or p_token is distinct from v_tok then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'months', (select coalesce(jsonb_agg(m order by m->>'ym'), '[]') from (
        select jsonb_build_object('ym', to_char(date_trunc('month', created_at), 'YYYY-MM'), 'n', count(*), 'rev', sum(total_eur),
                                  'buyers', count(distinct lower(customer->>'email'))) m
        from public.orders where status in ('confirmee', 'expediee', 'livree') and not demo and created_at > now() - interval '24 months'
        group by date_trunc('month', created_at)) x),
    'orders', (select count(*) from public.orders where status in ('confirmee', 'expediee', 'livree') and not demo),
    'revenue', (select coalesce(sum(total_eur), 0) from public.orders where status in ('confirmee', 'expediee', 'livree') and not demo),
    'buyers', (select count(distinct lower(customer->>'email')) from public.orders where status in ('confirmee', 'expediee', 'livree') and not demo),
    'repeat', (select count(*) from (select lower(customer->>'email') e from public.orders where status in ('confirmee', 'expediee', 'livree') and not demo
                                      group by 1 having count(*) > 1) r),
    'countries', (select count(distinct shipping->>'country') from public.orders where status in ('confirmee', 'expediee', 'livree') and not demo),
    'subscribers', (select count(*) from public.subscribers),
    'affiliates', (select count(*) from public.affiliates where data->>'status' = 'actif'),
    'followers', (select coalesce(sum((select coalesce(sum(((n->'hist'->-1)->>'n')::numeric), 0) from jsonb_array_elements(a.data->'networks') n)), 0)
                  from public.affiliates a where a.data->>'status' = 'actif'),
    'products', (select count(*) from public.products where active),
    'rating', (select round(avg(rating)::numeric, 1) from public.reviews where approved),
    'reviews', (select count(*) from public.reviews where approved),
    'at', now()
  );
end $$;
grant execute on function public.investor_snapshot(text) to anon, authenticated;
