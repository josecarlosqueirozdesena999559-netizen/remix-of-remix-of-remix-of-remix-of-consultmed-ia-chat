create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('whatsapp-maintenance-every-5-min');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'whatsapp-maintenance-every-5-min',
  '*/5 * * * *',
  $$
    select
      net.http_post(
        url := 'https://btfecoijribbvynljxxy.supabase.co/functions/v1/whatsapp-maintenance',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      );
  $$
);
