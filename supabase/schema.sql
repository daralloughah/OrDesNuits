-- =========================================================
-- OrDesNuits · base de données Supabase
-- À coller en une fois dans : Supabase → SQL Editor → New query → Run
-- Le script peut être relancé sans danger.
-- =========================================================

-- ---------- Administrateurs ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Profils clients ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  first_name text not null default '',
  country text,
  lang text not null default 'fr',
  optin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Produits ----------
create table if not exists public.products (
  id text primary key,
  shop text not null default 'lui' check (shop in ('lui', 'elle')),
  category text not null default 'miel',
  type text,
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  promo numeric(10,2) check (promo is null or promo >= 0),
  frame text not null default 'none',
  offer boolean not null default false,
  pinned boolean not null default false,
  active boolean not null default true,
  stock integer not null default 0,
  low_at integer not null default 5,
  sold integer not null default 0,
  img text,
  gallery jsonb not null default '[]',
  fit text not null default 'cover',
  descr jsonb not null default '{}',
  extra jsonb not null default '{}',
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Coûts d'achat : visibles uniquement par l'administrateur
create table if not exists public.product_costs (
  product_id text primary key references public.products on delete cascade,
  cost numeric(10,2)
);

-- ---------- Commandes ----------
create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  status text not null default 'nouvelle' check (status in ('nouvelle', 'confirmee', 'expediee', 'livree', 'annulee')),
  source text not null default 'site',
  payment text,
  paid_at timestamptz,
  shipped_at timestamptz,
  user_id uuid references auth.users on delete set null,
  customer jsonb not null default '{}',
  shipping jsonb not null default '{}',
  lang text,
  lines jsonb not null default '[]',
  subtotal_eur numeric(10,2) not null default 0,
  discount_eur numeric(10,2) not null default 0,
  total_eur numeric(10,2) not null default 0,
  display jsonb not null default '{}',
  stock_applied boolean not null default false,
  demo boolean not null default false
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_user_idx on public.orders (user_id);

-- ---------- Inscrits aux offres ----------
create table if not exists public.subscribers (
  email text primary key,
  source text,
  lang text,
  created_at timestamptz not null default now(),
  demo boolean not null default false
);

-- ---------- Réglages (offre 3+1, comptabilité…) ----------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values ('offer', '{"active": false, "buy": 3}') on conflict (key) do nothing;
-- (projets créés avant la v1.6)
alter table public.products add column if not exists extra jsonb not null default '{}';

-- ---------- Journal du Concierge IA (anti-abus) ----------
create table if not exists public.chat_log (
  id bigint generated always as identity primary key,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists chat_log_idx on public.chat_log (ip, created_at);

-- =========================================================
-- Sécurité : règles d'accès (RLS)
-- =========================================================
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.orders enable row level security;
alter table public.subscribers enable row level security;
alter table public.settings enable row level security;
alter table public.chat_log enable row level security;

drop policy if exists "admins: soi-même" on public.admins;
create policy "admins: soi-même" on public.admins for select using (user_id = auth.uid());

drop policy if exists "profils: lecture" on public.profiles;
create policy "profils: lecture" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profils: modification" on public.profiles;
create policy "profils: modification" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "produits: vitrine" on public.products;
create policy "produits: vitrine" on public.products for select using (active or public.is_admin());
drop policy if exists "produits: gestion" on public.products;
create policy "produits: gestion" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "coûts: admin" on public.product_costs;
create policy "coûts: admin" on public.product_costs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "commandes: lecture" on public.orders;
create policy "commandes: lecture" on public.orders for select using (
  user_id = auth.uid()
  or public.is_admin()
  -- commandes passées avant la création du compte, avec le même e-mail (confirmé)
  or (auth.jwt()->>'email' is not null and lower(customer->>'email') = lower(auth.jwt()->>'email'))
);
drop policy if exists "commandes: gestion" on public.orders;
create policy "commandes: gestion" on public.orders for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "inscrits: admin" on public.subscribers;
create policy "inscrits: admin" on public.subscribers for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "réglages: lecture" on public.settings;
create policy "réglages: lecture" on public.settings for select using (key = 'offer' or public.is_admin());
drop policy if exists "réglages: admin" on public.settings;
create policy "réglages: admin" on public.settings for all using (public.is_admin()) with check (public.is_admin());
-- chat_log : aucune règle = aucun accès public (seule la fonction serveur y écrit)

-- Droits de base (les règles RLS ci-dessus filtrent ensuite ligne par ligne)
grant usage on schema public to anon, authenticated;
grant select on public.products, public.settings to anon, authenticated;
grant select, insert, update, delete on public.products, public.product_costs, public.orders, public.subscribers, public.settings to authenticated;
grant select on public.admins, public.profiles to authenticated;
-- un client ne peut modifier que ces colonnes de son profil (pas son e-mail ni sa date)
revoke update on public.profiles from anon, authenticated;
grant update (first_name, country, lang, optin) on public.profiles to authenticated;
revoke all on public.chat_log from anon, authenticated;

-- =========================================================
-- Création automatique du profil à l'inscription
-- =========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_optin boolean := coalesce((new.raw_user_meta_data->>'optin')::boolean, false);
begin
  insert into public.profiles (id, email, first_name, country, lang, optin)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'first_name', ''),
          new.raw_user_meta_data->>'country', coalesce(new.raw_user_meta_data->>'lang', 'fr'), v_optin)
  on conflict (id) do nothing;
  if v_optin then
    insert into public.subscribers (email, source, lang) values (lower(new.email), 'compte', coalesce(new.raw_user_meta_data->>'lang', 'fr'))
    on conflict (email) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Fonctions publiques
-- =========================================================

-- Inscription aux offres (page OrDesSens, compte, commande)
create or replace function public.subscribe(p_email text, p_source text default 'site', p_lang text default 'fr')
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' or length(p_email) > 200 then return false; end if;
  insert into public.subscribers (email, source, lang) values (lower(trim(p_email)), left(p_source, 30), left(p_lang, 10))
  on conflict (email) do nothing;
  return true;
end $$;

-- Prix le plus avantageux pour exactement p_qty unités, en combinant les lots
-- (ex. 5 sticks = lot de 3 + lot de 2). Même calcul que js/core/pricing.js.
create or replace function public.best_cost(p_tiers jsonb, p_unit numeric, p_qty int)
returns numeric language plpgsql immutable set search_path = public as $$
declare best numeric[]; n int; t jsonb; tq int; tp numeric; v_top int; v_tiers jsonb; v_min numeric;
begin
  if p_qty <= 0 then return 0; end if;
  v_tiers := case when jsonb_typeof(p_tiers) = 'array' then p_tiers else '[]'::jsonb end;
  select p_qty + coalesce(max((x->>'q')::int), 1) into v_top from jsonb_array_elements(v_tiers) x;
  best := array_fill(null::numeric, array[v_top + 1]);
  best[1] := 0;
  for n in 1..v_top loop
    best[n + 1] := best[n] + p_unit;
    for t in select * from jsonb_array_elements(v_tiers) loop
      tq := (t->>'q')::int; tp := (t->>'p')::numeric;
      if tq >= 1 and tp > 0 and tq <= n and best[n - tq + 1] + tp < best[n + 1] then
        best[n + 1] := best[n - tq + 1] + tp;
      end if;
    end loop;
  end loop;
  -- jamais plus cher qu'une quantité supérieure
  select min(b) into v_min from unnest(best[p_qty + 1 : v_top + 1]) b;
  return round(v_min, 2);
end $$;

-- Passer commande : les prix, les lots et l'offre sont recalculés ICI,
-- jamais pris depuis le navigateur (impossible de tricher sur le prix).
create or replace function public.place_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_line jsonb; v_prod public.products; v_qty int; v_unit numeric; v_total numeric;
  v_lines jsonb := '[]'; v_units numeric[] := '{}'; v_sub numeric := 0; v_disc numeric := 0;
  v_free int; v_offer jsonb; v_id text; v_email text := lower(trim(p->'customer'->>'email'));
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
  v_disc := round(v_disc, 2);

  v_id := 'ODN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.orders (id, user_id, customer, shipping, lang, lines, subtotal_eur, discount_eur, total_eur, display)
  values (
    v_id, auth.uid(),
    jsonb_build_object('email', v_email, 'firstName', left(p->'customer'->>'firstName', 80), 'lastName', left(p->'customer'->>'lastName', 80),
                       'phone', left(p->'customer'->>'phone', 40), 'optin', coalesce((p->'customer'->>'optin')::boolean, false)),
    jsonb_build_object('country', left(p->'shipping'->>'country', 2), 'region', left(p->'shipping'->>'region', 3), 'address', left(p->'shipping'->>'address', 200),
                       'postcode', left(p->'shipping'->>'postcode', 20), 'city', left(p->'shipping'->>'city', 80)),
    left(p->>'lang', 10), v_lines, v_sub, v_disc, v_sub - v_disc, coalesce(p->'display', '{}')
  );
  if coalesce((p->'customer'->>'optin')::boolean, false) then
    insert into public.subscribers (email, source, lang) values (v_email, 'commande', left(p->>'lang', 10)) on conflict (email) do nothing;
  end if;
  return jsonb_build_object('id', v_id, 'lines', v_lines, 'subtotalEur', v_sub, 'discountEur', v_disc, 'totalEur', v_sub - v_disc);
end $$;

-- =========================================================
-- Fonctions réservées à l'administrateur
-- =========================================================

-- Change le statut d'une commande et gère le stock automatiquement
create or replace function public.admin_set_status(p_id text, p_status text, p_payment text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_o public.orders; v_line jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into v_o from public.orders where id = p_id for update;
  if not found then raise exception 'not_found'; end if;

  if p_status in ('confirmee', 'expediee', 'livree') and not v_o.stock_applied then
    for v_line in select * from jsonb_array_elements(v_o.lines) loop
      update public.products set stock = greatest(0, stock - (v_line->>'qty')::int), sold = sold + (v_line->>'qty')::int, updated_at = now()
      where id = v_line->>'id';
    end loop;
    v_o.stock_applied := true;
  elsif p_status = 'annulee' and v_o.stock_applied then
    for v_line in select * from jsonb_array_elements(v_o.lines) loop
      update public.products set stock = stock + (v_line->>'qty')::int, sold = greatest(0, sold - (v_line->>'qty')::int), updated_at = now()
      where id = v_line->>'id';
    end loop;
    v_o.stock_applied := false;
  end if;

  update public.orders set
    status = p_status,
    payment = coalesce(p_payment, payment),
    paid_at = case when p_status = 'confirmee' and paid_at is null then now() else paid_at end,
    shipped_at = case when p_status = 'expediee' then now() else shipped_at end,
    stock_applied = v_o.stock_applied
  where id = p_id returning * into v_o;
  return v_o;
end $$;

-- Ajuste le stock d'un produit (+1 / −1…)
create or replace function public.admin_adjust_stock(p_id text, p_delta int)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.products set stock = greatest(0, stock + p_delta), updated_at = now() where id = p_id returning stock into v;
  return v;
end $$;

grant execute on function public.subscribe(text, text, text) to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.best_cost(jsonb, numeric, int) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.admin_set_status(text, text, text) to authenticated;
grant execute on function public.admin_adjust_stock(text, int) to authenticated;

-- =========================================================
-- Photos des produits (Storage)
-- =========================================================
insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;

drop policy if exists "photos: lecture publique" on storage.objects;
create policy "photos: lecture publique" on storage.objects for select using (bucket_id = 'products');
drop policy if exists "photos: ajout admin" on storage.objects;
create policy "photos: ajout admin" on storage.objects for insert with check (bucket_id = 'products' and public.is_admin());
drop policy if exists "photos: modif admin" on storage.objects;
create policy "photos: modif admin" on storage.objects for update using (bucket_id = 'products' and public.is_admin());
drop policy if exists "photos: suppression admin" on storage.objects;
create policy "photos: suppression admin" on storage.objects for delete using (bucket_id = 'products' and public.is_admin());


-- =========================================================
-- v2.4 (intégrée pour les nouvelles installations)
-- =========================================================
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


-- v2.8 (intégrée)
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
