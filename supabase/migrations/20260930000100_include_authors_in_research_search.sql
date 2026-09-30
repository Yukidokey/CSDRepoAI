-- Include author names in repository keyword search so exact name searches
-- find papers even when their semantic embedding ranks them below the cutoff.
drop index if exists public.idx_research_search;
alter table public.research_papers drop column if exists search_vector;

alter table public.research_papers add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(array_to_string(authors, ' '), '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(abstract, '')), 'B') ||
    setweight(array_to_tsvector(coalesce(keywords, '{}')), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce(ocr_raw_text, '')), 'D')
  ) stored;

create index idx_research_search on public.research_papers using gin(search_vector);
