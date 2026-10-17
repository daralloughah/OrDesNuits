-- =========================================================
-- OrDesNuits · mise à jour v1.6 (formats & lots, fiche détaillée, revendeurs)
-- Relançable sans danger.
-- =========================================================
alter table public.products add column if not exists extra jsonb not null default '{}';
update public.settings set value = '{"active": false, "buy": 3}' where key = 'offer';

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

grant execute on function public.best_cost(jsonb, numeric, int) to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- Miels de démonstration : formats 1 / 2 / 3 / 6 / 12 / 24 et prix revendeurs
update public.products set price = 4.9, promo = null, frame = case when frame = 'promo' then 'none' else frame end,
  extra = extra || '{"tiers":[{"q":1,"p":4.9},{"q":2,"p":9},{"q":3,"p":13},{"q":6,"p":25,"label":"popular"},{"q":12,"p":40},{"q":24,"p":65.99}],
  "unitName":{"fr":["stick","sticks"],"en":["stick","sticks"],"es":["stick","sticks"],"pt":["stick","sticks"],"de":["Stick","Sticks"],"ar":["ستيك","ستيك"],"ru":["стик","шт."],"zh":["支","支"],"ja":["本","本"],"ko":["스틱","스틱"]},
  "wholesale":{"active":true,"unit":{"fr":"Boîte de 24 sticks","en":"Box of 24 sticks"},"min":5,"max":50,"tiers":[{"q":5,"p":150},{"q":10,"p":290},{"q":25,"p":600},{"q":50,"p":1150}]}}'::jsonb
where category = 'miel' and (extra->'tiers') is null;
