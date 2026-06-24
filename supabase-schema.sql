-- OrderKing — complete database schema
-- Run this in the Supabase SQL Editor on a fresh project.
-- Then create a public Storage bucket named "menu-images" (see bottom).

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  logo_url text,
  address text,
  card_surcharge_pct numeric(5,2) default 1.5,   -- default card surcharge %
  ph_surcharge_pct   numeric(5,2) default 10,     -- public-holiday surcharge %
  ph_active          boolean default false,       -- is PH surcharge currently on
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete cascade not null,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete cascade not null,
  category_id uuid references categories on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  available boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete cascade not null,
  table_number text not null,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete cascade not null,
  table_id uuid references tables,                 -- nullable: takeaway has no table
  table_number text not null,                      -- table no. or takeaway ticket (T01…)
  order_type text default 'dine_in',               -- 'dine_in' | 'takeaway'
  customer_name text,                              -- takeaway only
  customer_phone text,                             -- takeaway only
  status text default 'pending' check (status in ('pending','confirmed','ready','paid')),
  total numeric(10,2) not null,                    -- subtotal before surcharge
  notes text,
  -- checkout fields
  surcharge numeric(10,2),
  surcharge_reason text,
  grand_total numeric(10,2),
  payment_method text,                             -- 'cash' | 'card' | 'transfer'
  cash_received numeric(10,2),
  change_given numeric(10,2),
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders on delete cascade not null,
  menu_item_id uuid references menu_items,
  name text not null,
  price numeric(10,2) not null,
  quantity int not null
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table restaurants enable row level security;
alter table categories  enable row level security;
alter table menu_items  enable row level security;
alter table tables      enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- Restaurants: owner manages; public can read (diners load the menu header)
create policy "owner manage restaurants" on restaurants for all using (auth.uid() = owner_id);
create policy "public read restaurants"  on restaurants for select using (true);

-- Categories: owner manages; public read
create policy "owner manage categories" on categories for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);
create policy "public read categories" on categories for select using (true);

-- Menu items: owner manages; public read
create policy "owner manage menu_items" on menu_items for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);
create policy "public read menu_items" on menu_items for select using (true);

-- Tables: owner manages; public read
create policy "owner manage tables" on tables for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);
create policy "public read tables" on tables for select using (true);

-- Orders: owner reads/updates; anyone (diner) can insert
create policy "owner manage orders" on orders for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);
create policy "public insert orders" on orders for insert with check (true);

-- Order items: owner reads; anyone can insert
create policy "owner read order_items" on order_items for select using (
  order_id in (select id from orders where restaurant_id in (
    select id from restaurants where owner_id = auth.uid()
  ))
);
create policy "public insert order_items" on order_items for insert with check (true);

-- ─────────────────────────────────────────────────────────────
-- Realtime — push live order changes to the kitchen dashboard
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;

-- ─────────────────────────────────────────────────────────────
-- Storage (run in Dashboard → Storage, or via these policies)
-- 1. Create a PUBLIC bucket named "menu-images".
-- 2. Apply these object policies so owners can upload/update:
-- ─────────────────────────────────────────────────────────────
create policy "menu images public read" on storage.objects for select
  using (bucket_id = 'menu-images');
create policy "menu images upload" on storage.objects for insert
  to authenticated with check (bucket_id = 'menu-images');
create policy "menu images update" on storage.objects for update
  to authenticated using (bucket_id = 'menu-images');
