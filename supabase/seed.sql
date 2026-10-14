-- =========================================================
-- OrDesNuits · produits de démonstration
-- À lancer UNE fois après schema.sql (SQL Editor → New query → Run).
-- Ensuite, tout se gère depuis le Salon privé.
-- =========================================================
insert into public.products (id, shop, category, type, name, price, promo, frame, offer, pinned, active, stock, low_at, sold, img, gallery, fit, descr, sort) values
  ('nuit-ambre', 'lui', 'miel', null, 'Nuit d''Ambre', 4.5, 3.9, 'promo', true, true, true, 120, 5, 184, null, '[]'::jsonb, 'cover', '{"fr": "Un miel sombre aux reflets ambrés, en sachet de 10 g à glisser partout.", "en": "A dark, amber-toned honey in a 10 g sachet you can take anywhere."}'::jsonb, 0),
  ('or-noir', 'lui', 'miel', null, 'Or Noir', 4.5, null, 'none', true, false, true, 90, 5, 142, null, '[]'::jsonb, 'cover', '{"fr": "Notes boisées et caramel brûlé. Sachet de 10 g.", "en": "Woody notes and burnt caramel. 10 g sachet."}'::jsonb, 1),
  ('cedre-ambre', 'lui', 'huile', null, 'Cèdre & Ambre', 19.9, null, 'new', false, false, true, 40, 5, 61, null, '[]'::jsonb, 'cover', '{"fr": "Huile de massage au parfum de cèdre et d''ambre. 100 ml.", "en": "Massage oil scented with cedar and amber. 100 ml."}'::jsonb, 2),
  ('tabac-blond', 'lui', 'bougie', null, 'Tabac Blond', 24.9, null, 'none', false, false, true, 30, 5, 44, null, '[]'::jsonb, 'cover', '{"fr": "Bougie de massage : sa cire fondue devient une huile tiède.", "en": "Massage candle: its melted wax turns into a warm oil."}'::jsonb, 3),
  ('tempo', 'lui', 'gel', null, 'Tempo', 14.9, null, 'none', false, false, true, 7, 5, 58, null, '[]'::jsonb, 'cover', '{"fr": "Gel retardant. 15 ml.", "en": "Delay gel. 15 ml."}'::jsonb, 4),
  ('tempo-intense', 'lui', 'gel', null, 'Tempo Intense', 17.9, null, 'none', false, false, true, 25, 5, 23, null, '[]'::jsonb, 'cover', '{}'::jsonb, 5),
  ('rose-minuit', 'elle', 'miel', null, 'Rose de Minuit', 4.5, null, 'fav', true, true, true, 110, 5, 167, null, '[]'::jsonb, 'cover', '{"fr": "Un miel clair aux notes de rose. Sachet de 10 g.", "en": "A light honey with notes of rose. 10 g sachet."}'::jsonb, 6),
  ('fleur-oranger', 'elle', 'miel', null, 'Fleur d''Oranger', 4.5, null, 'none', true, false, true, 80, 5, 96, null, '[]'::jsonb, 'cover', '{}'::jsonb, 7),
  ('satin', 'elle', 'huile', null, 'Satin', 21.9, null, 'none', false, false, true, 35, 5, 52, null, '[]'::jsonb, 'cover', '{"fr": "Huile sèche pour le corps, fini satiné. 100 ml.", "en": "Dry body oil with a satin finish. 100 ml."}'::jsonb, 8),
  ('pivoine-vanille', 'elle', 'bougie', null, 'Pivoine & Vanille', 24.9, null, 'new', false, false, true, 30, 5, 37, null, '[]'::jsonb, 'cover', '{}'::jsonb, 9),
  ('soie', 'elle', 'soin', null, 'Soie', 12.9, null, 'none', false, false, true, 50, 5, 57, null, '[]'::jsonb, 'cover', '{"fr": "Gel intime à base d''eau. 100 ml.", "en": "Water-based intimate gel. 100 ml."}'::jsonb, 10)
on conflict (id) do nothing;
