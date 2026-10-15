-- Persistent audit trail of AI evaluations and teacher actions.
-- Run once in the Supabase SQL editor.
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  exam_id uuid references public.exams (id) on delete set null,
  exam_title text,
  event text not null,
  detail text,
  actor text,
  actor_type text not null default 'teacher',  -- 'teacher' | 'system'
  severity text not null default 'info',       -- 'success' | 'warning' | 'error' | 'info'
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

-- Teachers can only see and add their own events; events are never edited or deleted
create policy "Teachers read own audit events" on public.audit_events
  for select using (auth.uid() = teacher_id);
create policy "Teachers add own audit events" on public.audit_events
  for insert with check (auth.uid() = teacher_id);
