export function buildProfileState(user, profileData = null) {
  if (!user) return null;

  const metadata = user?.user_metadata ?? {};
  const normalizedEmail = (user?.email || profileData?.email || "").trim().toLowerCase();
  const inferredRole = profileData?.role || metadata.role || (normalizedEmail === "admin@csdrepoai.com" ? "admin" : null);

  return {
    id: profileData?.id || user.id,
    email: profileData?.email || user.email || null,
    full_name: profileData?.full_name || metadata.full_name || null,
    role: inferredRole,
    student_number: profileData?.student_number ?? null,
    faculty_number: profileData?.faculty_number ?? null,
    program: profileData?.program ?? null,
  };
}
