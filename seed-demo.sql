-- OrderKing — demo seed data (optional, for a public live demo)
--
-- PREREQUISITE: sign up once in the app with email  demo@orderking.uk
-- (any password). That creates the auth user this script claims as owner.
-- Then run this in the Supabase SQL Editor.
--
-- Stable demo IDs so the menu link never changes:
--   restaurant: 11111111-1111-1111-1111-111111111111
--   menu URL:   /menu/11111111-1111-1111-1111-111111111111/3

do $$
declare
  owner uuid;
  rid uuid := '11111111-1111-1111-1111-111111111111';
  c_starters uuid := gen_random_uuid();
  c_mains    uuid := gen_random_uuid();
  c_drinks   uuid := gen_random_uuid();
begin
  select id into owner from auth.users where email = 'demo@orderking.uk' limit 1;
  if owner is null then
    raise exception 'Sign up in the app with demo@orderking.uk first, then re-run this script.';
  end if;

  -- clean any previous demo data
  delete from restaurants where id = rid;

  insert into restaurants (id, owner_id, name, address, card_surcharge_pct)
  values (rid, owner, 'OrderKing Demo Kitchen', '123 George St, Sydney NSW', 1.5);

  insert into categories (id, restaurant_id, name, sort_order) values
    (c_starters, rid, 'Starters', 1),
    (c_mains,    rid, 'Mains',    2),
    (c_drinks,   rid, 'Drinks',   3);

  insert into menu_items (restaurant_id, category_id, name, description, price, sort_order) values
    (rid, c_starters, 'Spring Rolls (4 pcs)', 'Crispy vegetable spring rolls with sweet chilli', 8.50, 1),
    (rid, c_starters, 'Pork & Chive Dumplings (6 pcs)', 'Steamed or pan-fried', 10.00, 2),
    (rid, c_starters, 'Salt & Pepper Squid', 'Lightly battered, with house seasoning', 13.50, 3),
    (rid, c_mains, 'Beef Hor Fun', 'Wok-fried flat rice noodles with tender beef', 17.80, 1),
    (rid, c_mains, 'Kung Pao Chicken', 'Diced chicken, peanuts, dried chilli', 18.50, 2),
    (rid, c_mains, 'Mapo Tofu', 'Silken tofu in spicy Sichuan sauce', 16.00, 3),
    (rid, c_mains, 'Yangzhou Fried Rice', 'Egg, prawn, char siu, peas', 15.00, 4),
    (rid, c_drinks, 'Jasmine Tea (pot)', 'Free refills', 3.00, 1),
    (rid, c_drinks, 'Iced Lemon Tea', '', 4.50, 2),
    (rid, c_drinks, 'Coke / Sprite', '', 3.50, 3);

  insert into tables (restaurant_id, table_number) values
    (rid, '1'), (rid, '2'), (rid, '3'), (rid, '4'), (rid, '5'), (rid, '6');
end $$;
