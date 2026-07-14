create table content_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  type text not null check (type in ('listening', 'reading')),
  title text not null,
  url text not null,
  source text,
  description text,
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table speaking_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  prompt text not null,
  context_hint text,
  target_structures text[] default '{}',
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz default now()
);

alter table content_library enable row level security;
alter table speaking_prompts enable row level security;

create policy "own_content" on content_library for all using (auth.uid() = user_id);
create policy "own_prompts" on speaking_prompts for all using (auth.uid() = user_id);
