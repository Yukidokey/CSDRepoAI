import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import Layout from "../components/Layout";
import { PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const themeKey = profile?.id ? `csdrepoai-theme:${profile.id}` : null;
  const [darkMode, setDarkMode] = useState(() => Boolean(themeKey && localStorage.getItem(themeKey) === "dark"));
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  function chooseTheme(nextDarkMode) {
    if (themeKey) localStorage.setItem(themeKey, nextDarkMode ? "dark" : "light");
    setDarkMode(nextDarkMode);
  }

  async function confirmLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <Layout>
      <PageHeader eyebrow="Preferences" title="Settings" />

      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Appearance</h2>
            <p style={{ color: "var(--ink-500)", fontSize: 12.5, marginTop: 3 }}>Color theme</p>
          </div>
          <div
            role="group"
            aria-label="Color theme"
            style={{ display: "flex", gap: 4, padding: 3, border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)" }}
          >
            <button
              type="button"
              className={`btn btn-sm ${darkMode ? "btn-outline" : "btn-primary"}`}
              aria-pressed={!darkMode}
              onClick={() => chooseTheme(false)}
            >
              <Sun size={14} /> Light
            </button>
            <button
              type="button"
              className={`btn btn-sm ${darkMode ? "btn-primary" : "btn-outline"}`}
              aria-pressed={darkMode}
              onClick={() => chooseTheme(true)}
            >
              <Moon size={14} /> Dark
            </button>
          </div>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "20px 0" }} />

        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Account</h2>
            <p style={{ color: "var(--ink-500)", fontSize: 12.5, marginTop: 3 }}>Sign out of this session</p>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => setLogoutPending(true)}>
            <LogOut size={14} /> Log out
          </button>
        </section>
      </div>

      {logoutPending && (
        <div
          className="logout-dialog-backdrop"
          role="presentation"
          onClick={() => setLogoutPending(false)}
        >
          <div
            className="logout-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="settings-logout-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="logout-dialog-icon">
              <LogOut size={18} />
            </div>
            <div>
              <h2 id="settings-logout-title">Are you sure you want to log out?</h2>
              <p>Your current session will be ended.</p>
            </div>
            <div className="logout-dialog-actions">
              <button type="button" className="btn btn-outline" onClick={() => setLogoutPending(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmLogout}>
                Yes, log out
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
