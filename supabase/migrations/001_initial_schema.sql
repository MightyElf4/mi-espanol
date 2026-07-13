create table vocab_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  spanish text not null,
  english text not null,
  example_sentence text,
  tags text[] default '{}',
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  due_date date default current_date,
  interval_days integer default 0,
  ease_factor decimal default 2.5,
  review_count integer default 0,
  notes text,
  created_at timestamptz default now()
);

create table grammar_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  topic text not null,
  prompt text not null,
  correct_answer text not null,
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz default now()
);

create table grammar_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  exercise_id uuid references grammar_exercises not null,
  your_answer text not null,
  correct boolean not null,
  timestamp timestamptz default now()
);

create table listening_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  source text not null,
  date date default current_date,
  comprehension_rating integer check (comprehension_rating between 1 and 5),
  notes text,
  linked_vocab_ids uuid[] default '{}',
  created_at timestamptz default now()
);

create table reading_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  source text not null,
  date date default current_date,
  comprehension_rating integer check (comprehension_rating between 1 and 5),
  notes text,
  linked_vocab_ids uuid[] default '{}',
  created_at timestamptz default now()
);

create table speaking_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  date date default current_date,
  description text,
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  couldnt_say text,
  transcript text,
  created_at timestamptz default now()
);

create table daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  date date default current_date,
  stats_json jsonb default '{}',
  unique (user_id, date)
);

create table user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null unique,
  dark_mode boolean default true,
  streak_visible boolean default true,
  grammar_weak_topics text[] default '{}',
  vocab_goal integer default 3000,
  speaking_goal_per_week integer default 10,
  current_level text default 'intermediate',
  speaking_prompts text[] default '{}',
  updated_at timestamptz default now()
);

-- claude_log is written by Claude (service role) only. No RLS needed.
create table claude_log (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  description text not null,
  affected_table text,
  affected_ids uuid[] default '{}',
  timestamp timestamptz default now(),
  notes text
);

alter table vocab_cards enable row level security;
alter table grammar_exercises enable row level security;
alter table grammar_attempts enable row level security;
alter table listening_log enable row level security;
alter table reading_log enable row level security;
alter table speaking_log enable row level security;
alter table daily_stats enable row level security;
alter table user_settings enable row level security;

create policy "own_vocab" on vocab_cards for all using (auth.uid() = user_id);
create policy "own_grammar_ex" on grammar_exercises for all using (auth.uid() = user_id);
create policy "own_grammar_att" on grammar_attempts for all using (auth.uid() = user_id);
create policy "own_listening" on listening_log for all using (auth.uid() = user_id);
create policy "own_reading" on reading_log for all using (auth.uid() = user_id);
create policy "own_speaking" on speaking_log for all using (auth.uid() = user_id);
create policy "own_stats" on daily_stats for all using (auth.uid() = user_id);
create policy "own_settings" on user_settings for all using (auth.uid() = user_id);
