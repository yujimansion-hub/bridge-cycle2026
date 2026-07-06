-- =====================================================================
-- 承継OS「GATE」 一括セットアップSQL（何度でも再実行OK・idempotent）
-- 内訳：schema → payments → harden_storename → notifications
-- =====================================================================

-- ########## 1/4 schema.sql ##########
-- =====================================================================
-- 承継OS「GATE」 — Supabase バックエンド スキーマ
-- 店主オーディション 半自動マッチングシステム（全国 / 複数支援者 / 運営一元管理型）
-- 実行方法：Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 前提：拡張 pgcrypto（gen_random_uuid）は Supabase で既定有効
-- =====================================================================

-- ---------- 0. 役割・プロフィール ----------
do $$ begin
  if not exists (select 1 from pg_type where typname='user_role') then
    create type user_role as enum ('admin','supporter');
  end if;
end $$;

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'supporter',
  full_name   text,
  org         text,                 -- 所属（商工会・信金・診断士事務所など）
  pref        text,                 -- 主担当の都道府県
  email       text,
  created_at  timestamptz not null default now()
);

-- サインアップ時に profiles を自動作成（既定=supporter）
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- 権限ヘルパ
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- 1. 退店店主（売り手） ----------
create table if not exists stores (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references profiles(id) default auth.uid(),   -- 登録した支援者
  owner_real    text,               -- 店主実名（運営/登録者のみ）
  store_name    text,               -- 店名（実名・S3まで伏せる）
  industry      text not null,      -- 業種カテゴリ（飲食/美容/小売…）
  sub_industry  text,               -- 細業種（カフェ/ラーメン…）
  pref          text not null,      -- 都道府県
  city          text not null,      -- 市区町村
  tsubo         numeric,            -- 規模（坪）
  price_man     numeric,            -- 承継対価（万円）
  exit_ym       text,              -- 退去/閉店の目安（YYYY-MM）
  status        text not null default '募集中',  -- 募集中/保留/成立/取下
  is_anonymous  boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------- 2. 継ぎ手（買い手） ----------
create table if not exists successors (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references profiles(id) default auth.uid(),
  full_name     text,
  pref_industry text not null,      -- 希望業種カテゴリ
  pref_sub      text,               -- 希望細業種（任意）
  areas         text[] not null default '{}', -- 希望市区町村（複数）
  pref          text,               -- 希望都道府県
  scale_min     numeric,            -- 希望規模 最小（坪）
  scale_max     numeric,            -- 希望規模 最大（坪）
  fund_man      numeric,            -- 自己資金（万円）
  start_ym      text,              -- 開業希望（YYYY-MM）
  kyc_verified  boolean not null default false,
  status        text not null default '募集中',
  created_at    timestamptz not null default now()
);

-- ---------- 3. マッチング結果 ----------
create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  successor_id uuid not null references successors(id) on delete cascade,
  total        numeric not null,
  a1           numeric not null,    -- 業種地域規模
  a2           numeric not null,    -- 価格・財務
  a3           numeric not null,    -- 時期
  band         text not null,       -- 有力/候補/保留/資金要件未達
  computed_at  timestamptz not null default now(),
  unique(store_id, successor_id)
);

-- ---------- 4. 段階開示ケース（S0→S4） ----------
create table if not exists cases (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references stores(id) on delete cascade,
  successor_id   uuid not null references successors(id) on delete cascade,
  stage          int  not null default 0,  -- 0匿名/1打診/2詳細開示/3店名開示/4成立
  kyc            boolean not null default false,
  nda            boolean not null default false,
  fee_disclosure boolean not null default false, -- 情報開示料(1万)の入金
  noncircum      boolean not null default false, -- 非circumvention署名
  owner_approved boolean not null default false, -- 店主のワンタップ承認
  seller_fee_man numeric,           -- 成立時 売り手手数料（定額）
  buyer_fee_man  numeric,           -- 成立時 買い手手数料（定額）
  settled_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique(store_id, successor_id)
);

-- ---------- 5. 監査ログ ----------
create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid default auth.uid(),
  action     text not null,
  entity     text,
  entity_id  uuid,
  meta       jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 6. マッチング・エンジン（3軸スコアリング）
--    a1 業種地域規模(重み0.40) / a2 価格・財務(0.35) / a3 時期(0.25)
--    band: 資金比<0.5→資金要件未達 / total>=75→有力 / 60-74→候補 / <60→保留
-- =====================================================================
create or replace function ym_to_months(ym text)
returns int language sql immutable as $$
  select case when ym ~ '^\d{4}-\d{1,2}$'
    then (split_part(ym,'-',1))::int*12 + (split_part(ym,'-',2))::int else null end;
$$;

create or replace function match_for_successor(p_successor_id uuid)
returns setof matches language plpgsql security definer set search_path=public as $$
declare s successors; st stores; a1 numeric; a2 numeric; a3 numeric; ratio numeric; tot numeric; bd text; md int;
begin
  select * into s from successors where id=p_successor_id;
  if not found then raise exception 'successor % not found', p_successor_id; end if;
  delete from matches where successor_id=p_successor_id;
  for st in select * from stores where status='募集中' loop
    -- a1 業種地域規模
    a1 := 0;
    if s.pref_sub is not null and st.sub_industry is not null and s.pref_sub = st.sub_industry then a1:=a1+50;
    elsif s.pref_industry = st.industry then a1:=a1+30; end if;
    if st.city = any(s.areas) then a1:=a1+30;
    elsif s.pref is not null and s.pref = st.pref then a1:=a1+18;
    else a1:=a1+6; end if;
    if st.tsubo is not null and s.scale_min is not null and s.scale_max is not null then
      if st.tsubo between s.scale_min and s.scale_max then a1:=a1+20;
      elsif st.tsubo between s.scale_min*0.8 and s.scale_max*1.2 then a1:=a1+12;
      else a1:=a1+4; end if;
    else a1:=a1+10; end if;
    -- a2 価格・財務（自己資金/承継対価）
    if st.price_man is null or st.price_man=0 then ratio:=1; else ratio:=coalesce(s.fund_man,0)/st.price_man; end if;
    a2 := case when ratio>=1.5 then 100 when ratio>=1.0 then 85 when ratio>=0.7 then 65 when ratio>=0.5 then 45 else 20 end;
    -- a3 時期
    md := abs(coalesce(ym_to_months(st.exit_ym),0) - coalesce(ym_to_months(s.start_ym),0));
    a3 := case when ym_to_months(st.exit_ym) is null or ym_to_months(s.start_ym) is null then 60
               when md<=1 then 100 when md<=3 then 85 when md<=6 then 70 when md<=12 then 50 else 30 end;
    tot := round(0.40*a1 + 0.35*a2 + 0.25*a3, 1);
    bd := case when ratio<0.5 then '資金要件未達' when tot>=75 then '有力' when tot>=60 then '候補' else '保留' end;
    insert into matches(store_id,successor_id,total,a1,a2,a3,band)
      values(st.id,p_successor_id,tot,a1,a2,a3,bd)
      on conflict (store_id,successor_id) do update
        set total=excluded.total,a1=excluded.a1,a2=excluded.a2,a3=excluded.a3,band=excluded.band,computed_at=now();
  end loop;
  return query select * from matches where successor_id=p_successor_id order by total desc;
end; $$;

-- 有力ペア(75+)から段階開示ケースを自動生成（S0）
create or replace function handoff_case(p_store uuid, p_successor uuid)
returns cases language plpgsql security definer set search_path=public as $$
declare c cases;
begin
  insert into cases(store_id,successor_id,stage) values(p_store,p_successor,0)
    on conflict (store_id,successor_id) do nothing;
  select * into c from cases where store_id=p_store and successor_id=p_successor;
  insert into events(action,entity,entity_id) values('handoff_case','cases',c.id);
  return c;
end; $$;

-- =====================================================================
-- 7. 段階開示ステートマシン（S0→S4・各ゲート自動判定）
-- =====================================================================
create or replace function advance_case(p_case_id uuid)
returns cases language plpgsql security definer set search_path=public as $$
declare c cases; nxt int;
begin
  select * into c from cases where id=p_case_id;
  if not found then raise exception 'case % not found', p_case_id; end if;
  nxt := c.stage;
  if    c.stage=0 and c.kyc and c.nda then nxt:=1;                 -- 打診（eKYC＋守秘）
  elsif c.stage=1 and c.fee_disclosure then nxt:=2;               -- 詳細開示（情報開示料）
  elsif c.stage=2 and c.noncircum and c.owner_approved then nxt:=3;-- 店名開示（非circ＋店主承認）
  elsif c.stage=3 then nxt:=4;                                    -- 成立
       update cases set settled_at=now() where id=p_case_id;
  end if;
  update cases set stage=nxt where id=p_case_id;
  insert into events(action,entity,entity_id,meta)
    values('advance_case','cases',p_case_id,jsonb_build_object('from',c.stage,'to',nxt));
  select * into c from cases where id=p_case_id; return c;
end; $$;

-- =====================================================================
-- 8. 店名マスク（S3未満／非当事者には伏せる）用ビュー
-- =====================================================================
create or replace function can_see_store_name(p_store uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select is_admin() or exists(
    select 1 from cases c join successors su on su.id=c.successor_id
    where c.store_id=p_store and c.stage>=3 and su.created_by=auth.uid());
$$;

create or replace view v_stores as
  select s.id, s.created_by,
    case when is_admin() then s.owner_real else null end as owner_real,
    case when can_see_store_name(s.id) then s.store_name else '●●●（S3で開示）' end as store_name,
    s.industry, s.sub_industry, s.pref, s.city, s.tsubo, s.price_man, s.exit_ym,
    s.status, s.is_anonymous, s.created_at
  from stores s;

-- =====================================================================
-- 9. RLS（運営一元管理型）
--   admin=運営（全権）／supporter=登録・閲覧（自分の登録は編集可）
--   ※ 店名の列レベル保護は本v1では表示側マスク(v_stores)で担保。
--     より厳格なDBレベル列保護は Phase2（security_invokerビュー＋列権限）で強化。
-- =====================================================================
alter table profiles   enable row level security;
alter table stores     enable row level security;
alter table successors enable row level security;
alter table matches    enable row level security;
alter table cases      enable row level security;
alter table events     enable row level security;

drop policy if exists p_profiles_sel on profiles;
create policy p_profiles_sel on profiles for select using (id=auth.uid() or is_admin());
drop policy if exists p_profiles_upd on profiles;
create policy p_profiles_upd on profiles for update using (id=auth.uid()) with check (id=auth.uid());

drop policy if exists p_stores_sel on stores;
create policy p_stores_sel on stores for select to authenticated using (true);
drop policy if exists p_stores_ins on stores;
create policy p_stores_ins on stores for insert to authenticated with check (created_by=auth.uid());
drop policy if exists p_stores_mod on stores;
create policy p_stores_mod on stores for update to authenticated using (is_admin() or created_by=auth.uid());
drop policy if exists p_stores_del on stores;
create policy p_stores_del on stores for delete to authenticated using (is_admin() or created_by=auth.uid());

drop policy if exists p_succ_sel on successors;
create policy p_succ_sel on successors for select to authenticated using (true);
drop policy if exists p_succ_ins on successors;
create policy p_succ_ins on successors for insert to authenticated with check (created_by=auth.uid());
drop policy if exists p_succ_mod on successors;
create policy p_succ_mod on successors for update to authenticated using (is_admin() or created_by=auth.uid());
drop policy if exists p_succ_del on successors;
create policy p_succ_del on successors for delete to authenticated using (is_admin() or created_by=auth.uid());

drop policy if exists p_match_sel on matches;
create policy p_match_sel on matches for select to authenticated using (true);

drop policy if exists p_case_sel on cases;
create policy p_case_sel on cases for select to authenticated using (true);
drop policy if exists p_case_ins on cases;
create policy p_case_ins on cases for insert to authenticated with check (true);
drop policy if exists p_case_mod on cases;
create policy p_case_mod on cases for update to authenticated using (
  is_admin() or exists(select 1 from successors su where su.id=successor_id and su.created_by=auth.uid()));

drop policy if exists p_events_ins on events;
create policy p_events_ins on events for insert to authenticated with check (true);
drop policy if exists p_events_sel on events;
create policy p_events_sel on events for select to authenticated using (is_admin());

grant execute on function match_for_successor(uuid), advance_case(uuid), handoff_case(uuid,uuid) to authenticated;

-- =====================================================================
-- 10. 運営を最初のadminにする（Supabaseでユーザー作成後、自分のUUIDで実行）
--   update profiles set role='admin' where email='info@bridgecycleco.com';
-- =====================================================================

-- ########## 2/4 payments.sql ##########
-- =====================================================================
-- 承継OS「GATE」 — 情報開示料 決済（Stripe）用 追加スキーマ
-- schema.sql を投入した後に、SQL Editor で実行してください。
-- =====================================================================

-- cases に決済関連の列を追加
alter table cases add column if not exists fee_paid_at        timestamptz;
alter table cases add column if not exists stripe_session_id  text;

-- 決済記録
create table if not exists payments (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid references cases(id) on delete set null,
  stripe_session_id  text unique,
  amount             int,                    -- 円（10000 = ¥10,000）
  status             text not null default 'pending',  -- pending / paid / failed
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);

alter table payments enable row level security;

-- 閲覧：運営、または当該ケースの継ぎ手を登録した支援者
drop policy if exists p_pay_sel on payments;
create policy p_pay_sel on payments for select to authenticated using (
  is_admin() or exists(
    select 1 from cases c join successors su on su.id = c.successor_id
    where c.id = payments.case_id and su.created_by = auth.uid()));

-- 書き込みは Webhook（service_role）のみ＝ authenticated 向けの insert/update ポリシーは作らない
-- （service_role は RLS をバイパスするため、Webレイヤからの改ざんを防止）

-- ########## 3/4 harden_storename.sql ##########
-- =====================================================================
-- 承継OS「GATE」 Phase2 セキュリティ強化：店名・店主実名の DBレベル保護
-- schema.sql 投入後に、SQL Editor で実行してください。
--
-- 目的：支援者(supporter)がベーステーブル stores を直接 SELECT できないようにし、
--       閲覧は「マスク済みビュー v_stores」経由のみに限定する。
--       店名/店主実名は「運営 or 登録した支援者 or S3+の当事者」だけが見える。
-- =====================================================================

-- 1) 開示可否の判定（登録した支援者＝created_by を追加）
create or replace function can_see_store_name(p_store uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select is_admin()
    or exists (select 1 from stores s
               where s.id = p_store and s.created_by = auth.uid())
    or exists (select 1 from cases c
               join successors su on su.id = c.successor_id
               where c.store_id = p_store and c.stage >= 3 and su.created_by = auth.uid());
$$;

-- 2) マスク済みビューを再定義（owner_real も同条件で保護）
--    security_invoker=false（=定義者権限）で実行され、ビュー所有者(postgres)が
--    base を読むため RLS をバイパス。列は CASE でマスクして返す。
drop view if exists v_stores;
create view v_stores with (security_invoker = false) as
  select s.id, s.created_by,
    case when can_see_store_name(s.id) then s.owner_real else null end               as owner_real,
    case when can_see_store_name(s.id) then s.store_name else '●●●（S3で開示）' end as store_name,
    s.industry, s.sub_industry, s.pref, s.city, s.tsubo, s.price_man, s.exit_ym,
    s.status, s.is_anonymous, s.created_at
  from stores s;

-- 3) ベーステーブル stores の SELECT を運営(admin)限定に
--    （supporter は base を読めず、v_stores 経由でのみ閲覧）
drop policy if exists p_stores_sel on stores;
create policy p_stores_sel on stores for select to authenticated using (is_admin());

-- 4) 権限（多層防御）
--    ・base stores への SELECT 権限を authenticated から剥奪
--      → supporter も admin も base を直接 SELECT 不可（読取は v_stores に一本化）
--      → admin は v_stores で実名が見える（can_see_store_name が is_admin を含む）
--    ・登録/編集/削除の権限は維持（RLSの作成者/運営ポリシーで制御）
revoke select on stores from authenticated;
grant  select on v_stores to authenticated;
grant  insert, update, delete on stores to authenticated;

-- 補足：
--  ・matches / cases は store_id のみ保持し店名を持たないため漏えい経路なし。
--  ・マッチング関数 match_for_successor は SECURITY DEFINER で base を読むが、
--    返すのは store_id とスコアのみ（店名は含めない）。表示は v_stores 経由。
--  ・継ぎ手(successors)の氏名保護が必要になれば、同様のビュー方式で追加可能。

-- ########## 4/4 notifications.sql ##########
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

