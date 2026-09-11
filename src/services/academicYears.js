import { supabase } from "../lib/supabaseClient";

export async function getAcademicYears({ activeOnly = false } = {}) {
  let query = supabase
    .from("academic_years")
    .select("*")
    .order("label", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createAcademicYear({ label, is_active = true, sort_order = 0 } = {}) {
  const normalizedLabel = (label || "").trim();
  if (!normalizedLabel) {
    throw new Error("Academic year is required.");
  }

  const { data, error } = await supabase
    .from("academic_years")
    .insert({
      label: normalizedLabel,
      is_active,
      sort_order,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAcademicYear(id, updates = {}) {
  const payload = { ...updates };

  if (payload.label !== undefined) {
    payload.label = payload.label.trim();
    if (!payload.label) {
      throw new Error("Academic year is required.");
    }
  }

  const { data, error } = await supabase
    .from("academic_years")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAcademicYear(id) {
  const { error } = await supabase.from("academic_years").delete().eq("id", id);
  if (error) throw error;
}
