-- Stores the exam's semester (e.g. "Semester VII"), shown with the subject.
-- Without it the semester is not kept after a reload.
-- Run once in the Supabase SQL editor.
alter table public.exams add column if not exists semester text;
