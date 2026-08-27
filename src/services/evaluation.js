import { supabase } from "../lib/supabaseClient";

export async function saveEvaluation({ respondentId, susAnswers, isoAnswers, comments }) {
  const { data, error } = await supabase
    .from("system_evaluations")
    .upsert({ respondent_id: respondentId, sus_answers: susAnswers, iso_answers: isoAnswers, comments }, { onConflict: "respondent_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getEvaluations() {
  const { data, error } = await supabase
    .from("system_evaluations")
    .select("*, profiles:respondent_id(full_name, role)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export function scoreSus(answers) {
  if (!answers?.length) return 0;
  const total = answers.reduce((sum, answer, index) => sum + (index % 2 === 0 ? answer - 1 : 5 - answer), 0);
  return Math.round(total * 2.5);
}

export function averageIso(evaluations) {
  const values = (evaluations || []).flatMap((evaluation) => Object.values(evaluation.iso_answers || {}).map(Number));
  return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) : "0.00";
}