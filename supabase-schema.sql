-- Run this in Supabase SQL Editor

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  logo_url text,
  address text,
  created_at timestamptz default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete cascade not null,
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
  table_id uuid references tables,
  table_number text not null,
  status text default 'pending' check (status in ('pending','confirmed','ready','paid')),
  total numeric(10,2) not null,
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

-- Row Level Security
alter table restaurants enable row level security;
alter table menu_items enable row level security;
alter table tables enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Restaurants: owner can do everything
create policy "owner all" on restaurants for all using (auth.uid() = owner_id);

-- Menu items: owner can manage, anyone can read
create policy "owner manage" on menu_items for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);
create policy "public read" on menu_items for select using (true);

-- Tables: owner can manage, anyone can read
create policy "owner manage" on tables for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);
create policy "public read" on tables for select using (true);

-- Orders: owner can read/update, anyone can insert
create policy "owner manage" on orders for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);
create policy "public insert" on orders for insert with check (true);

-- Order items: owner can read, anyone can insert
create policy "owner read" on order_items for select using (
  order_id in (select id from orders where restaurant_id in (
    select id from restaurants where owner_id = auth.uid()
  ))
);
create policy "public insert" on order_items for insert with check (true);

-- Storage bucket for menu images (run separately in Storage settings)
-- Create a bucket called "menu-images" and set it to public
