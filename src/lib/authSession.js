import { buildProfileState } from './authProfile.js';

export function applyAuthenticatedSession({ session, user, setSession, setProfile }) {
  const nextSession = session ?? null;
  const nextProfile = buildProfileState(user, {
    id: user?.id ?? null,
    email: user?.email ?? null,
    full_name: user?.user_metadata?.full_name ?? null,
    first_name: user?.user_metadata?.first_name ?? null,
    middle_name: user?.user_metadata?.middle_name ?? null,
    last_name: user?.user_metadata?.last_name ?? null,
    suffix: user?.user_metadata?.suffix ?? null,
    role: user?.user_metadata?.role ?? null,
    student_number: user?.user_metadata?.student_number ?? null,
    faculty_number: user?.user_metadata?.faculty_number ?? null,
    program: user?.user_metadata?.program ?? null,
  });

  setSession(nextSession);
  setProfile(nextProfile);

  return { session: nextSession, profile: nextProfile };
}
