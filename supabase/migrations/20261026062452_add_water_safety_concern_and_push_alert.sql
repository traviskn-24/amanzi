alter table public.water_updates
  drop constraint if exists water_updates_water_status_check;

alter table public.water_updates
  add constraint water_updates_water_status_check
  check (water_status in ('no_water', 'low_pressure', 'restored', 'unclassified', 'water_safety_concern'));

alter table public.push_alert_events
  drop constraint if exists push_alert_events_event_type_check;

alter table public.push_alert_events
  add constraint push_alert_events_event_type_check
  check (event_type in ('outage', 'restoration', 'safety_concern'));
