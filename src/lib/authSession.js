import { buildProfileState } from './authProfile.js';

export function applyAuthenticatedSession({ session, user, setSession, setProfile }) {
  const nextSession = session ?? null;
  const nextProfile = buildProfileState(user, {
    id: user?.id ?? null,
    email: user?.email ?? null,
    full_name: user?.user_metadata?.full_name ?? null,
    role: user?.user_metadata?.role ?? null,
    student_number: user?.user_metadata?.student_number ?? null,
    program: user?.user_metadata?.program ?? null,
  });

  setSession(nextSession);
  setProfile(nextProfile);

  return { session: nextSession, profile: nextProfile };
}
