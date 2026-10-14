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
insert into public.settings (key, value) values ('offer', '{"active": true, "buy": 3}') on conflict (key) do nothing;

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

-- Passer commande : les prix et l'offre 3+1 sont recalculés ICI,
-- jamais pris depuis le navigateur (impossible de tricher sur le prix).
create or replace function public.place_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_line jsonb; v_prod public.products; v_qty int; v_unit numeric;
  v_lines jsonb := '[]'; v_units numeric[] := '{}'; v_sub numeric := 0; v_disc numeric := 0;
  v_free int; v_offer jsonb; v_id text; v_email text := lower(trim(p->'customer'->>'email'));
begin
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'email'; end if;
  if jsonb_array_length(coalesce(p->'lines', '[]')) = 0 or jsonb_array_length(p->'lines') > 30 then raise exception 'lines'; end if;

  for v_line in select * from jsonb_array_elements(p->'lines') loop
    v_qty := greatest(1, least(50, coalesce((v_line->>'qty')::int, 1)));
    select * into v_prod from public.products where id = v_line->>'id' and active;
    if not found then raise exception 'product:%', v_line->>'id'; end if;
    if v_prod.stock <= 0 then raise exception 'sold_out:%', v_prod.name; end if;
    v_unit := case when v_prod.promo is not null and v_prod.promo < v_prod.price then v_prod.promo else v_prod.price end;
    v_sub := v_sub + v_unit * v_qty;
    v_lines := v_lines || jsonb_build_object('id', v_prod.id, 'name', v_prod.name, 'qty', v_qty, 'unitEur', v_unit, 'shop', v_prod.shop, 'category', v_prod.category);
    if v_prod.offer then
      for i in 1..v_qty loop v_units := v_units || v_unit; end loop;
    end if;
  end loop;

  select value into v_offer from public.settings where key = 'offer';
  if coalesce((v_offer->>'active')::boolean, true) then
    v_free := floor(coalesce(array_length(v_units, 1), 0) / (coalesce((v_offer->>'buy')::int, 3) + 1));
    select coalesce(sum(u), 0) into v_disc from (select unnest(v_units) u order by 1 limit v_free) s;
  end if;

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
