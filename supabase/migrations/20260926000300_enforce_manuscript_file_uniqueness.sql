-- Store an exact file fingerprint so metadata/title edits cannot hide a
-- re-upload of the same manuscript. Rejected/editing rows are excluded so
-- students can revise a rejected paper in place.
alter table public.research_papers
  add column if not exists manuscript_sha256 text;

create unique index if not exists idx_research_active_manuscript_sha256
  on public.research_papers (manuscript_sha256)
  where manuscript_sha256 is not null
    and status not in ('rejected', 'student_editing');
