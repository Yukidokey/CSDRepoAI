import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Search as SearchIcon,
  User,
  Users,
  ScanLine,
  ClipboardCheck,
  Archive as ArchiveIcon,
  BarChart3,
  LogOut,
  Menu,
  X,
  Target,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SDG_LIST } from "../lib/sdgList";

const NAV_ITEMS = {
  student: [
    { to: "/student", label: "Dashboard", end: true, icon: LayoutDashboard },
    { to: "/student/submit", label: "Submit Research", icon: Upload },
    { to: "/student/my-submissions", label: "My Submissions", icon: FileText },
    { to: "/student/archive", label: "Research Archive", icon: ArchiveIcon },
    { type: "sdg-group", key: "sdg", label: "Browse by SDG", icon: Target, basePath: "/student/archive" },
    { to: "/student/search", label: "AI Search", icon: SearchIcon },
    { to: "/student/profile", label: "Profile", icon: User },
  ],
  faculty: [
    { to: "/faculty", label: "Dashboard", end: true, icon: LayoutDashboard },
    { to: "/faculty/archive", label: "Research Archive", icon: ArchiveIcon },
    { type: "sdg-group", key: "sdg", label: "Browse by SDG", icon: Target, basePath: "/faculty/archive" },
    { to: "/faculty/search", label: "AI Search", icon: SearchIcon },
    { to: "/faculty/review", label: "Review & Approval", icon: ClipboardCheck },
    { to: "/faculty/analytics", label: "Research Analytics", icon: BarChart3 },
    { to: "/faculty/profile", label: "Profile", icon: User },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", end: true, icon: LayoutDashboard },
    { to: "/admin/users", label: "User Management", icon: Users },
    { to: "/admin/academic-years", label: "Academic Years", icon: ClipboardList },
    { to: "/admin/ocr", label: "Document Digitization", icon: ScanLine },
    { to: "/admin/review", label: "Review & Approval", icon: ClipboardCheck },
    { to: "/admin/archive", label: "Research Archive", icon: ArchiveIcon },
    { to: "/admin/search", label: "AI Search", icon: SearchIcon },
    { to: "/admin/analytics", label: "Research Analytics", icon: BarChart3 },
    { to: "/admin/profile", label: "Profile", icon: User },
  ],
};

const ROLE_LABEL = {
  student: "Student Portal",
  faculty: "Faculty Portal",
  admin: "Administrator",
};

export default function Layout({ children }) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [logoutPending, setLogoutPending] = useState(false);
  const items = NAV_ITEMS[role] || [];
  const initials = (profile?.full_name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Prevent background scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function handleLogout() {
    setLogoutPending(true);
  }

  async function confirmLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <img src="/logo.png" alt="CSDRepoAI logo" className="mobile-topbar-logo" width="26" height="26" />
          <span className="mobile-topbar-title">CSDRepoAI</span>
        </div>
        <div className="mobile-topbar-actions">
          <button
            className="mobile-menu-btn"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
        </div>
      </div>

      <div className={`sidebar-backdrop${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)} />

      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <div className="sidebar-brand" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="CSDRepoAI logo" className="sidebar-logo" width="34" height="34" />
            <div>
              <div className="sidebar-title">CSDRepoAI</div>
              <div className="sidebar-subtitle">{ROLE_LABEL[role]}</div>
            </div>
          </div>
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            style={{ display: menuOpen ? "flex" : "none" }}
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => {
            if (item.type === "sdg-group") {
              const Icon = item.icon;
              const isOpen = Boolean(openGroups[item.key]);
              const activeSdg = location.pathname.startsWith(item.basePath) && location.search.includes("sdg=");
              return (
                <div key={item.key} className="sidebar-group">
                  <button
                    type="button"
                    className={`sidebar-link sidebar-group-toggle${activeSdg ? " active" : ""}`}
                    onClick={() => setOpenGroups((g) => ({ ...g, [item.key]: !g[item.key] }))}
                    aria-expanded={isOpen}
                  >
                    <Icon size={16} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <ChevronDown
                      size={14}
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div className="sidebar-subnav">
                      {SDG_LIST.map((sdg) => (
                        <NavLink
                          key={sdg.id}
                          to={`${item.basePath}?sdg=${sdg.id}`}
                          className={({ isActive }) => {
                            const active =
                              location.pathname === item.basePath &&
                              location.search === `?sdg=${sdg.id}`;
                            return `sidebar-sublink${active ? " active" : ""}`;
                          }}
                        >
                          <span className="sidebar-sublink-num">{sdg.id}</span>
                          {sdg.title}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-avatar">{initials}</span>
            <span>{profile?.full_name}</span>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </aside>
      <main className="app-main">{children}</main>
      {logoutPending && (
        <div
          className="logout-dialog-backdrop"
          role="presentation"
          onClick={() => setLogoutPending(false)}
        >
          <div
            className="logout-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="logout-dialog-icon">
              <LogOut size={18} />
            </div>
            <div>
              <h2 id="logout-dialog-title">Are you sure you want to logout?</h2>
              <p>Your current session will be ended.</p>
            </div>
            <div className="logout-dialog-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setLogoutPending(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
