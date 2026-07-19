create table grammar_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  topic text not null unique,
  title text not null,
  explanation_es text not null,
  explanation_en text not null,
  examples jsonb not null default '[]',
  common_errors jsonb not null default '[]',
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz default now()
);

create table reading_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  body text not null,
  source text not null default 'pasted' check (source in ('seeded', 'pasted')),
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Shared reference data: no user_id, read-only for app users
create table dict_lemmas (
  id bigint generated always as identity primary key,
  lemma text not null,
  pos text not null,
  gloss text not null
);
create index dict_lemmas_lemma_idx on dict_lemmas (lemma);

create table dict_forms (
  form text not null,
  lemma text not null,
  primary key (form, lemma)
);

alter table grammar_lessons enable row level security;
alter table reading_texts enable row level security;
alter table dict_lemmas enable row level security;
alter table dict_forms enable row level security;

create policy "own_lessons" on grammar_lessons for all using (auth.uid() = user_id);
create policy "own_texts" on reading_texts for all using (auth.uid() = user_id);
create policy "dict_lemmas_read" on dict_lemmas for select to authenticated using (true);
create policy "dict_forms_read" on dict_forms for select to authenticated using (true);
