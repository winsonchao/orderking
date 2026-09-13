-- OrderKing — local seed data
-- Automatically applied during `supabase start` and `supabase db reset`

create extension if not exists pgcrypto;

do $$
declare
  demo_user_id uuid := 'a0000000-0000-0000-0000-000000000001';
  rid uuid := '11111111-1111-1111-1111-111111111111';
  c_starters uuid := '20000000-0000-0000-0000-000000000001';
  c_mains    uuid := '20000000-0000-0000-0000-000000000002';
  c_drinks   uuid := '20000000-0000-0000-0000-000000000003';
begin
  -- 1. Create demo auth user (demo@orderking.uk / 123456) if not exists
  if not exists (select 1 from auth.users where email = 'demo@orderking.uk') then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      demo_user_id,
      'authenticated',
      'authenticated',
      'demo@orderking.uk',
      crypt('123456', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Demo Kitchen Owner"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      demo_user_id,
      demo_user_id,
      format('{"sub":"%s","email":"%s"}', demo_user_id, 'demo@orderking.uk')::jsonb,
      'email',
      'demo@orderking.uk',
      now(),
      now(),
      now()
    ) on conflict (provider, provider_id) do nothing;
  else
    select id into demo_user_id from auth.users where email = 'demo@orderking.uk' limit 1;

    -- Ensure token/change columns are empty strings (not null) to satisfy Go scanner
    update auth.users
    set
      encrypted_password = crypt('123456', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      phone_change = coalesce(phone_change, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      reauthentication_token = coalesce(reauthentication_token, '')
    where id = demo_user_id;
  end if;

  -- 2. Clear existing demo restaurant data for clean idempotency
  delete from restaurants where id = rid;

  -- 3. Insert demo restaurant
  insert into restaurants (id, owner_id, name, address, card_surcharge_pct)
  values (rid, demo_user_id, 'OrderKing Demo Kitchen', '123 George St, Sydney NSW', 1.5);

  -- 4. Insert categories
  insert into categories (id, restaurant_id, name, sort_order) values
    (c_starters, rid, 'Starters', 1),
    (c_mains,    rid, 'Mains',    2),
    (c_drinks,   rid, 'Drinks',   3);

  -- 5. Insert menu items
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

  -- 6. Insert tables 1-6
  insert into tables (restaurant_id, table_number) values
    (rid, '1'), (rid, '2'), (rid, '3'), (rid, '4'), (rid, '5'), (rid, '6');
end $$;
