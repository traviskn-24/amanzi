alter table public.water_updates
  add column if not exists water_status text not null default 'unclassified'
  check (water_status in ('no_water', 'low_pressure', 'restored', 'unclassified'));
