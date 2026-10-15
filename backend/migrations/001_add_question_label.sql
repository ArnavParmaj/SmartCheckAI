-- Stores the printed question label (e.g. "Q1(b)") so sub-questions can be
-- told apart. question_number is only the question's position in the exam.
-- Run once in the Supabase SQL editor.
alter table public.questions add column if not exists label text;
