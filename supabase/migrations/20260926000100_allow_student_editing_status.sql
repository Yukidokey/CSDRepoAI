-- Keep the deployed database status constraint aligned with the application.
-- Student editing is a persisted review state used to prevent concurrent review.
alter table public.research_papers
  drop constraint if exists research_papers_status_check;

alter table public.research_papers
  add constraint research_papers_status_check
  check (status in ('pending', 'under_review', 'student_editing', 'approved', 'rejected'));
