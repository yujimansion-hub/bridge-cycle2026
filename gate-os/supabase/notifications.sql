-- =====================================================================
-- 承継OS「GATE」 通知トリガ（段階開示の進行・有力マッチで notify を呼ぶ）
-- schema.sql 投入後に実行。pg_net 拡張と app_config 設定が必要。
-- =====================================================================
create extension if not exists pg_net;

-- 通知の宛先・関数URL・共有シークレットを保持（運営のみ閲覧/編集）
create table if not exists app_config (
  key   text primary key,
  value text
);
alter table app_config enable row level security;
drop policy if exists p_cfg on app_config;
create policy p_cfg on app_config for all to authenticated
  using (is_admin()) with check (is_admin());

-- ▼ 実運用前に設定してください（値は自分のものに）
-- insert into app_config(key,value) values
--   ('notify_url','https://<project-ref>.supabase.co/functions/v1/notify'),
--   ('notify_secret','（notifyのNOTIFY_SECRETと同じ値）'),
--   ('admin_email','info@bridgecycleco.com'),
--   ('admin_line','（LINEのユーザー/グループID・任意）')
-- on conflict (key) do update set value=excluded.value;

-- 段階開示が進んだら運営へ通知
create or replace function notify_case_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare url text; sec text; adm text; ln text; msg text; labels text[]:='{S0匿名,S1打診,S2詳細開示,S3店名開示,S4成立}';
begin
  if new.stage = old.stage then return new; end if;
  select value into url from app_config where key='notify_url';
  select value into sec from app_config where key='notify_secret';
  select value into adm from app_config where key='admin_email';
  select value into ln  from app_config where key='admin_line';
  if url is null then return new; end if;
  msg := format('ケース %s が %s へ進みました（%s→%s）。', new.id, labels[new.stage+1], old.stage, new.stage);
  perform net.http_post(
    url := url,
    body := jsonb_build_object('to',adm,'line_to',ln,'subject','[GATE] 段階開示が進みました','text',msg),
    headers := jsonb_build_object('Content-Type','application/json','x-notify-secret',sec));
  return new;
end; $$;
drop trigger if exists trg_notify_case on cases;
create trigger trg_notify_case after update of stage on cases
  for each row execute function notify_case_change();

-- 有力マッチ(75+)が生成されたら運営へ通知
create or replace function notify_top_match()
returns trigger language plpgsql security definer set search_path=public as $$
declare url text; sec text; adm text; ln text;
begin
  if new.band <> '有力' then return new; end if;
  select value into url from app_config where key='notify_url';
  select value into sec from app_config where key='notify_secret';
  select value into adm from app_config where key='admin_email';
  select value into ln  from app_config where key='admin_line';
  if url is null then return new; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('to',adm,'line_to',ln,'subject','[GATE] 有力マッチが出ました',
      'text',format('総合 %s の有力マッチが生成されました。ハンドオフをご確認ください。', new.total)),
    headers := jsonb_build_object('Content-Type','application/json','x-notify-secret',sec));
  return new;
end; $$;
drop trigger if exists trg_notify_top on matches;
create trigger trg_notify_top after insert on matches
  for each row when (new.band = '有力') execute function notify_top_match();
