import { useEffect, useState } from "react";
import { Eye, EyeOff, Search, Users } from "lucide-react";
import Layout from "../../components/Layout";
import { PageHeader, EmptyState, Avatar, StatGrid, StatCard, Field, Button } from "../../components/ui";
import { createUserAccount, getUsers, updateUserRole, setUserActive } from "../../services/users";
import { validatePassword } from "../../lib/authValidation";
import { supabaseServiceConfigured } from "../../lib/supabaseClient";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "student",
    student_number: "",
    program: "",
  });
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const users = await getUsers();
      setUsers(users || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
      setLoadError(error?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRoleChange(userId, role) {
    await updateUserRole(userId, role);
    load();
  }

  async function handleToggleActive(userId, current) {
    await setUserActive(userId, !current);
    load();
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreating(true);

    if (!newUser.email || !newUser.full_name) {
      setCreateError("Please fill in the required fields.");
      setCreating(false);
      return;
    }

    if (newUser.password) {
      const pwCheck = validatePassword(newUser.password);
      if (!pwCheck.ok) {
        setCreateError(pwCheck.message || "Password does not meet requirements.");
        setCreating(false);
        return;
      }
    }
    try {
      await createUserAccount({ ...newUser, password: newUser.password || undefined });
      setCreateSuccess("User created successfully. If confirmation is required, they should receive an email shortly.");
      setNewUser({
        email: "",
        password: "",
        full_name: "",
        role: "student",
        student_number: "",
        program: "",
      });
      load();
    } catch (error) {
      console.error("Failed to create user:", error);
      setCreateError(error.message || "Unable to create the user account.");
    } finally {
      setCreating(false);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader eyebrow="Administration" title="User Management" description="View, verify, and manage every account in CSDRepoAI." />

      <StatGrid>
        <StatCard label="Total Accounts" value={users.length} accent="brass" />
        <StatCard label="Students" value={users.filter((u) => u.role === "student").length} accent="info" />
        <StatCard label="Faculty" value={users.filter((u) => u.role === "faculty").length} accent="info" />
        <StatCard label="Active" value={users.filter((u) => u.is_active).length} accent="success" />
      </StatGrid>

      <div style={{ position: "relative", maxWidth: 320, margin: "22px 0 18px" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: 12, color: "var(--ink-300)" }} />
        <input
          className="input"
          placeholder="Search by name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>

      {loadError ? (
        <div className="card">
          <EmptyState icon={Users} title="Unable to load users">
            <div style={{ whiteSpace: "pre-wrap" }}>{loadError}</div>
            {!supabaseServiceConfigured && (
              <div style={{ marginTop: 10 }}>
                This usually means the Supabase service role key is missing or invalid. Please set `VITE_SUPABASE_SERVICE_ROLE` in your project's `.env` to your Supabase
                service_role key and restart the app.
              </div>
            )}
            {loadError.toLowerCase().includes("invalid api key") && (
              <div style={{ marginTop: 8 }}>
                The API key appears invalid. Replace the key with the correct service role key and restart the dev server.
              </div>
            )}
          </EmptyState>
        </div>
      ) : loading ? (
        <div className="table-wrap card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 20 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Users} title="No users found">
            No users match that search.
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Student No.</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={u.full_name} size={30} />
                      <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td>{u.student_number || "—"}</td>
                  <td>
                    <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="input" style={{ padding: "5px 8px", fontSize: 12.5, width: "auto" }}>
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? "badge-success" : "badge-neutral"}`}>{u.is_active ? "Active" : "Deactivated"}</span>
                  </td>
                  <td>
                    <button onClick={() => handleToggleActive(u.id, u.is_active)} className={`btn btn-sm ${u.is_active ? "btn-danger" : "btn-success"}`}>
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              Create user account
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-900)", marginBottom: 0 }}>
              Add a new repository user from the admin dashboard.
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => setShowCreateForm((prev) => !prev)}>
            {showCreateForm ? "Hide" : "Show"}
          </Button>
        </div>
        {showCreateForm && (
          <form
            onSubmit={handleCreateUser}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              alignItems: "end",
            }}
          >
            <Field label="Full name">
              <input
                className="input"
                value={newUser.full_name}
                onChange={(e) => setNewUser((prev) => ({ ...prev, full_name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </Field>
            <Field label="Password">
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={newUser.password}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--ink-500)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <Field label="Role">
              <select
                className="input"
                value={newUser.role}
                onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </Field>
            {newUser.role === "student" && (
              <>
                <Field label="Student number">
                  <input
                    className="input"
                    value={newUser.student_number}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, student_number: e.target.value }))}
                  />
                </Field>
                <Field label="Program">
                  <select
                    className="input"
                    value={newUser.program}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, program: e.target.value }))}
                    required
                  >
                    <option value="">Select program</option>
                    <option value="BSIT">Bachelor of Science in Information Technology (BSIT)</option>
                    <option value="BSCS">Bachelor of Science in Computer Science (BSCS)</option>
                    <option value="BSIS">Bachelor of Science in Information Systems (BSIS)</option>
                    <option value="BSCpE">Bachelor of Science in Computer Engineering (BSCpE)</option>
                    <option value="Associate/Diploma in Computer Technology">Associate/Diploma in Computer Technology</option>
                  </select>
                </Field>
              </>
            )}
            {createError && (
              <p className="auth-error" style={{ gridColumn: "1 / -1" }}>
                {createError}
              </p>
            )}
            {createSuccess && (
              <p className="auth-info" style={{ gridColumn: "1 / -1" }}>
                {createSuccess}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={creating} style={{ gridColumn: "1 / -1" }}>
              {creating ? "Creating..." : "Create user"}
            </Button>
          </form>
        )}
      </div>
    </Layout>
  );
}
