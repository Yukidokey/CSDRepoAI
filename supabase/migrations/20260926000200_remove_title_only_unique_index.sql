-- The application allows titles to be reused when submissions contain
-- different research content. Remove the legacy title-only uniqueness rule.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'idx_research_unique_normalized_title'
      and conrelid = 'public.research_papers'::regclass
  ) then
    alter table public.research_papers
      drop constraint idx_research_unique_normalized_title;
  end if;
end;
$$;

drop index if exists public.idx_research_unique_normalized_title;
