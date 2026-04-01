-- SenangBah initial Postgres schema for Supabase.
-- Goal: stay close to the current SQLite layout so data migration and code replacement are simpler.

begin;

create table if not exists public.users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  form integer not null,
  estimated_band double precision not null,
  weaknesses text not null,
  strengths text not null,
  class_name text,
  teacher_name text,
  teacher_id text,
  referral_code text unique,
  referred_by_user_id text references public.users(id),
  referred_by_code text,
  bonus_stars integer not null default 0,
  created_at timestamptz not null
);

create table if not exists public.student_referrals (
  id text primary key,
  referrer_user_id text not null references public.users(id) on delete cascade,
  referred_user_id text not null unique references public.users(id) on delete cascade,
  code_used text not null,
  reward_status text not null,
  created_at timestamptz not null
);

create table if not exists public.school_codes (
  code text primary key,
  school_name text,
  created_at timestamptz not null
);

create table if not exists public.teachers (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  code text not null unique,
  school_code text not null default 'senang' references public.school_codes(code),
  created_at timestamptz not null
);

create table if not exists public.sessions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  current_step text not null,
  today_focus text not null,
  content text not null,
  core_answer text,
  created_at timestamptz not null
);

create table if not exists public.responses (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  step text not null,
  prompt_json text not null,
  model_json text not null,
  student_answer text,
  created_at timestamptz not null
);

create table if not exists public.weekly_checkpoints (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  prompt_json text not null,
  student_answer text,
  feedback_json text,
  created_at timestamptz not null
);

create table if not exists public.chat_messages (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  question text not null,
  answer text not null,
  english_question text not null,
  quick_tip text not null,
  created_at timestamptz not null
);

create table if not exists public.vocab_sessions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  current_step text not null,
  target_word text not null,
  word_info text not null,
  created_at timestamptz not null
);

create table if not exists public.vocab_responses (
  id text primary key,
  session_id text not null references public.vocab_sessions(id) on delete cascade,
  step text not null,
  prompt_json text not null,
  model_json text not null,
  student_answer text,
  created_at timestamptz not null
);

create table if not exists public.essay_uploads (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  file_path text not null,
  original_name text not null,
  extracted_text text not null,
  analysis_json text not null,
  created_at timestamptz not null
);

create table if not exists public.grammar_sessions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  current_step text not null,
  grammar_info text not null,
  created_at timestamptz not null
);

create table if not exists public.grammar_responses (
  id text primary key,
  session_id text not null references public.grammar_sessions(id) on delete cascade,
  step text not null,
  prompt_json text not null,
  model_json text not null,
  student_answer text,
  created_at timestamptz not null
);

create table if not exists public.reading_sessions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  current_step text not null,
  reading_info text not null,
  created_at timestamptz not null
);

create table if not exists public.reading_responses (
  id text primary key,
  session_id text not null references public.reading_sessions(id) on delete cascade,
  step text not null,
  prompt_json text not null,
  model_json text not null,
  student_answer text,
  created_at timestamptz not null
);

create table if not exists public.pilot_registrations (
  id text primary key,
  role text not null,
  full_name text not null,
  age integer not null,
  school_name text not null,
  email text not null unique,
  phone text not null,
  address text not null,
  previous_result_type text not null,
  previous_result text not null,
  self_intro_text text not null default '',
  self_intro_analysis_json text,
  plan_choice text not null,
  status text not null,
  created_at timestamptz not null
);

create table if not exists public.register_examples (
  id bigint generated by default as identity primary key,
  sort_order integer not null unique,
  before_text text not null,
  after_text text not null,
  updated_at timestamptz not null
);

create index if not exists idx_users_teacher_id on public.users(teacher_id);
create index if not exists idx_sessions_user_date on public.sessions(user_id, date desc);
create index if not exists idx_sessions_user_step on public.sessions(user_id, current_step);
create index if not exists idx_responses_session_created on public.responses(session_id, created_at);
create index if not exists idx_weekly_checkpoints_user_date on public.weekly_checkpoints(user_id, date desc);
create index if not exists idx_chat_messages_user_created on public.chat_messages(user_id, created_at desc);
create index if not exists idx_vocab_sessions_user_date on public.vocab_sessions(user_id, date desc);
create index if not exists idx_vocab_responses_session_created on public.vocab_responses(session_id, created_at);
create index if not exists idx_essay_uploads_user_created on public.essay_uploads(user_id, created_at desc);
create index if not exists idx_grammar_sessions_user_date on public.grammar_sessions(user_id, date desc);
create index if not exists idx_grammar_responses_session_created on public.grammar_responses(session_id, created_at);
create index if not exists idx_reading_sessions_user_date on public.reading_sessions(user_id, date desc);
create index if not exists idx_reading_responses_session_created on public.reading_responses(session_id, created_at);
create index if not exists idx_pilot_registrations_status_created on public.pilot_registrations(status, created_at desc);

insert into public.school_codes (code, school_name, created_at)
values ('senang', 'Default', now())
on conflict (code) do nothing;

insert into public.register_examples (sort_order, before_text, after_text, updated_at)
values
  (1, 'I like study with my friends because fun.', 'Studying with my friends keeps me motivated and improves my discipline.', now()),
  (2, 'English is hard and I cannot write good.', 'English writing is challenging for me, but I am improving through daily short practice.', now()),
  (3, 'My goal is pass SPM only.', 'My goal is to reach Band 6 so I can enter a better pre-university program.', now())
on conflict (sort_order) do nothing;

commit;

-- Optional hardening after duplicate cleanup:
-- alter table public.sessions add constraint sessions_user_date_unique unique (user_id, date);
-- alter table public.vocab_sessions add constraint vocab_sessions_user_date_unique unique (user_id, date);
-- alter table public.grammar_sessions add constraint grammar_sessions_user_date_unique unique (user_id, date);
-- alter table public.reading_sessions add constraint reading_sessions_user_date_unique unique (user_id, date);
