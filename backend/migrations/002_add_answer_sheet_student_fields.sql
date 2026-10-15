-- Stores who an answer sheet belongs to. Without these the app falls back to the
-- uploaded file name and a generated roll number.
-- Run once in the Supabase SQL editor.
alter table public.answer_sheets add column if not exists student_name text;
alter table public.answer_sheets add column if not exists roll_number text;
