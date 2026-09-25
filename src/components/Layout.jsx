import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  Bell,
  Menu,
  X,
  Target,
  ChevronDown,
  ClipboardList,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SDG_LIST } from "../lib/sdgList";
import { getAuditTrail } from "../services/research";

const NAV_ITEMS = {
  student: [
    { to: "/student", label: "Dashboard", end: true, icon: LayoutDashboard },
    { to: "/student/submit", label: "Submit Research", icon: Upload },
    { to: "/student/my-submissions", label: "My Submissions", icon: FileText },
    { to: "/student/archive", label: "Research Archive", icon: ArchiveIcon },
    { type: "sdg-group", key: "sdg", label: "Browse by SDG", icon: Target, basePath: "/student/archive" },
    { to: "/student/search", label: "AI Search", icon: SearchIcon },
    { to: "/student/profile", label: "Profile", icon: User },
    { to: "/student/settings", label: "Settings", icon: SettingsIcon },
  ],
  faculty: [
    { to: "/faculty", label: "Dashboard", end: true, icon: LayoutDashboard },
    { to: "/faculty/archive", label: "Research Archive", icon: ArchiveIcon },
    { type: "sdg-group", key: "sdg", label: "Browse by SDG", icon: Target, basePath: "/faculty/archive" },
    { to: "/faculty/search", label: "AI Search", icon: SearchIcon },
    { to: "/faculty/review", label: "Review & Approval", icon: ClipboardCheck },
    { to: "/faculty/analytics", label: "Research Analytics", icon: BarChart3 },
    { to: "/faculty/profile", label: "Profile", icon: User },
    { to: "/faculty/settings", label: "Settings", icon: SettingsIcon },
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
    { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
  ],
};

const ROLE_LABEL = {
  student: "Student Portal",
  faculty: "Faculty Portal",
  admin: "Administrator",
};

export default function Layout({ children }) {
  const { profile, role, user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsSeen, setNotificationsSeen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const themeKey = profile?.id ? `csdrepoai-theme:${profile.id}` : null;
  const items = NAV_ITEMS[role] || [];
  const accountEmail = profile?.email || user?.email || "No email available";
  const profileName = [profile?.first_name, profile?.middle_name, profile?.last_name, profile?.suffix]
    .filter(Boolean)
    .join(" ")
    .trim() || (profile?.full_name && !profile.full_name.includes("@") ? profile.full_name : role === "admin" ? "Admin" : "Account");
  const initials = (profileName || "?")
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

  useEffect(() => {
    const nextDarkMode = themeKey && localStorage.getItem(themeKey) === "dark";
    document.documentElement.dataset.theme = nextDarkMode ? "dark" : "light";
  }, [themeKey]);

  useEffect(() => {
    let mounted = true;
    setNotificationsLoading(true);
    getAuditTrail({ limit: 6 })
      .then((entries) => {
        if (mounted) setNotifications(entries || []);
      })
      .catch(() => {
        if (mounted) setNotifications([]);
      })
      .finally(() => {
        if (mounted) setNotificationsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  function formatNotificationAction(action) {
    return String(action || "activity").replaceAll("_", " ");
  }

  function formatNotificationTime(createdAt) {
    if (!createdAt) return "Recently";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(createdAt));
  }

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <img src="/logo.png" alt="CSDRepoAI logo" className="mobile-topbar-logo" width="26" height="26" />
          <span className="mobile-topbar-title">CSDRepoAI</span>
        </div>
        <div className="mobile-topbar-actions">
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
                    className={`sidebar-link sidebar-group-toggle${activeSdg ? " sidebar-group-current" : ""}`}
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
                            return `sidebar-sublink${active ? " sidebar-sublink-current" : ""}`;
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
                className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link-current" : ""}`}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

      </aside>
      <main className="app-main">
        <header className="portal-topbar">
          <div className="portal-topbar-actions">
            <div className="portal-profile-menu-wrap">
              <button type="button" className="portal-profile-button" onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen}>
                <span className="portal-profile-avatar">{initials}</span><span className="portal-profile-name">{profileName}</span><ChevronDown size={14} />
              </button>
              {profileMenuOpen && <div className="portal-profile-menu"><strong>{profileName}</strong><span className="portal-profile-email">{accountEmail}</span><span>{ROLE_LABEL[role]}</span><NavLink to={`${role === "admin" ? "/admin" : role === "faculty" ? "/faculty" : "/student"}/profile`} onClick={() => setProfileMenuOpen(false)}>View profile</NavLink></div>}
            </div>
            <div className="portal-notification-wrap">
              <button type="button" className="portal-icon-button" aria-label={`Notifications${notifications.length ? `, ${notifications.length} recent activities` : ""}`} title="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setNotificationsSeen(true); }}><Bell size={17} />{notifications.length > 0 && <span className={`portal-notification-count${notificationsSeen ? " is-seen" : ""}`}>{notifications.length > 99 ? "99+" : notifications.length}</span>}</button>
              {notificationsOpen && (
                <div className="portal-notification-menu" role="dialog" aria-label="Recent repository activity">
                  <div className="portal-notification-heading"><div><strong>Notifications</strong><span>Recent repository activity</span></div></div>
                  {notificationsLoading ? <div className="portal-notification-empty">Loading activity...</div> : notifications.length === 0 ? <div className="portal-notification-empty">No recent activity.</div> : notifications.map((entry) => <div className="portal-notification-item" key={entry.id}><span className="portal-notification-item-dot" /><div><strong>{formatNotificationAction(entry.action)}</strong><span>{entry.paperTitle}</span><small>{entry.actorName} · {formatNotificationTime(entry.created_at)}</small></div></div>)}
                </div>
              )}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
