import { useState } from "react";
import Layout from "../components/Layout";
import { PageHeader, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../services/users";

export default function Profile() {
  const { profile, user } = useAuth();
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    program: profile?.program || "",
    student_number: profile?.student_number || "",
  });
  const [saved, setSaved] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    await updateProfile(user.id, form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Layout>
      <PageHeader eyebrow="Account" title="Profile" description="Keep your account details accurate and up to date." />

      <div className="profile-form-shell">
        <div className="card card-pad profile-card">
          <div className="profile-card-heading">
            <span className="profile-card-kicker">Personal details</span>
            <h2>Account information</h2>
            <p>Update the details used across your research submissions.</p>
          </div>
          <form onSubmit={handleSave} className="profile-form">
          <Field label="Full name">
            <input className="input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </Field>
          {profile?.role === "student" && (
            <>
              <Field label="Program">
                <input className="input" value={form.program} onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))} />
              </Field>
              <Field label="Student number">
                <input className="input" value={form.student_number} onChange={(e) => setForm((f) => ({ ...f, student_number: e.target.value }))} />
              </Field>
            </>
          )}
          <Field label="Email">
            <input className="input" value={user?.email || ""} disabled style={{ color: "var(--ink-500)", background: "var(--surface-sunken)" }} />
          </Field>
          <Field label="Role">
            <input className="input" value={profile?.role || ""} disabled style={{ color: "var(--ink-500)", background: "var(--surface-sunken)", textTransform: "capitalize" }} />
          </Field>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}>
            Save Changes
          </button>
          {saved && <p style={{ color: "var(--success-700)", fontSize: 13 }}>Saved.</p>}
          </form>
        </div>
      </div>
    </Layout>
  );
}
