-- Let students see notifications for their own submissions while keeping
-- other students' submission activity private.
drop policy if exists "logs_select_own_submission_activity" on submission_logs;
create policy "logs_select_own_submission_activity" on submission_logs for select
  using (exists (
    select 1 from research_papers paper
    where paper.id = submission_logs.paper_id
      and paper.submitted_by = auth.uid()
  ));
