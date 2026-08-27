import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a page and only renders it if the logged-in user's role
 * is included in `allowedRoles`. Otherwise redirects to /login
 * (if not logged in) or to their own dashboard (if wrong role).
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, role, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading...</div>;

  if (!session) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={`/${role}`} replace />;
  }

  return children;
}
