import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RoleRedirect() {
  const { role, loading, profile } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  const resolvedRole = profile?.role || role;
  if (!resolvedRole) return <Navigate to="/login" replace />;
  return <Navigate to={`/${resolvedRole}`} replace />;
}
