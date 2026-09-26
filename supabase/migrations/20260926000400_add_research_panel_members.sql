-- OCR digitization and paper submission inserts store panel names here.
alter table public.research_papers
  add column if not exists panel_members text[] not null default '{}';

-- Make the new column visible to PostgREST immediately after migration.
notify pgrst, 'reload schema';
