-- Stores each question's knowledge base: the rubric criteria with their marks and
-- the answer-key points that earn them, as reviewed by the faculty.
-- Without it only the model answer is kept and criteria are rebuilt at grading time.
-- Run once in the Supabase SQL editor.
alter table public.answer_keys add column if not exists rubric_criteria jsonb;
