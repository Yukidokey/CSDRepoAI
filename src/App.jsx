import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import RoleRedirect from "./pages/RoleRedirect";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import Archive from "./pages/Archive";
import AdminArchive from "./pages/admin/Archive";

import StudentDashboard from "./pages/student/Dashboard";
import Submit from "./pages/student/Submit";
import MySubmissions from "./pages/student/MySubmissions";

import FacultyDashboard from "./pages/faculty/Dashboard";

import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import OCRScan from "./pages/admin/OCRScan";
import ReviewApproval from "./pages/admin/ReviewApproval";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/redirect" element={<RoleRedirect />} />
          <Route path="/" element={<Login />} />

          {/* Student routes */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={["student"]}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/submit" element={<ProtectedRoute allowedRoles={["student"]}><Submit /></ProtectedRoute>} />
          <Route path="/student/my-submissions" element={<ProtectedRoute allowedRoles={["student"]}><MySubmissions /></ProtectedRoute>} />
          <Route path="/student/ocr" element={<ProtectedRoute allowedRoles={["student"]}><OCRScan /></ProtectedRoute>} />
          <Route path="/student/archive" element={<ProtectedRoute allowedRoles={["student"]}><Archive /></ProtectedRoute>} />
          <Route path="/student/search" element={<ProtectedRoute allowedRoles={["student"]}><Search /></ProtectedRoute>} />
          <Route path="/student/analytics" element={<ProtectedRoute allowedRoles={["student"]}><Analytics /></ProtectedRoute>} />
          <Route path="/student/profile" element={<ProtectedRoute allowedRoles={["student"]}><Profile /></ProtectedRoute>} />

          {/* Faculty routes */}
          <Route path="/faculty" element={<ProtectedRoute allowedRoles={["faculty"]}><FacultyDashboard /></ProtectedRoute>} />
          <Route path="/faculty/submit" element={<ProtectedRoute allowedRoles={["faculty"]}><Submit /></ProtectedRoute>} />
          <Route path="/faculty/my-submissions" element={<ProtectedRoute allowedRoles={["faculty"]}><MySubmissions /></ProtectedRoute>} />
          <Route path="/faculty/ocr" element={<ProtectedRoute allowedRoles={["faculty"]}><OCRScan /></ProtectedRoute>} />
          <Route path="/faculty/archive" element={<ProtectedRoute allowedRoles={["faculty"]}><Archive /></ProtectedRoute>} />
          <Route path="/faculty/search" element={<ProtectedRoute allowedRoles={["faculty"]}><Search /></ProtectedRoute>} />
          <Route path="/faculty/analytics" element={<ProtectedRoute allowedRoles={["faculty"]}><Analytics /></ProtectedRoute>} />
          <Route path="/faculty/profile" element={<ProtectedRoute allowedRoles={["faculty"]}><Profile /></ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/ocr" element={<ProtectedRoute allowedRoles={["admin"]}><OCRScan /></ProtectedRoute>} />
          <Route path="/admin/review" element={<ProtectedRoute allowedRoles={["admin"]}><ReviewApproval /></ProtectedRoute>} />
          <Route path="/admin/archive" element={<ProtectedRoute allowedRoles={["admin"]}><AdminArchive /></ProtectedRoute>} />
          <Route path="/admin/search" element={<ProtectedRoute allowedRoles={["admin"]}><Search /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={["admin"]}><Analytics /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={["admin"]}><Profile /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
