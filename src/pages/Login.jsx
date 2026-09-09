import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPasswordStrength, validatePassword } from "../lib/authValidation";
import { Field } from "../components/ui";

export default function Login() {
  const { signIn, signUp, handleRecoveryLink, updatePassword, resetPassword, recoverySession } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    role: "student",
    studentNumber: "",
    program: "",
  });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryActive, setRecoveryActive] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [failedLoginAttempts, setFailedLoginAttempts] = useState(0);
  const [lockoutStage, setLockoutStage] = useState(0);
  const [loginLockedUntil, setLoginLockedUntil] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const passwordStrength = mode === "signup" ? getPasswordStrength(form.password) : null;

  useEffect(() => {
    let mounted = true;

    async function processRecoveryLink() {
      const result = await handleRecoveryLink();
      if (!mounted) return;

      if (result?.handled && !result.error) {
        setRecoveryActive(true);
        setInfo("Your password reset link is active. Please choose a new password.");
        setError("");
      } else if (result?.handled && result.error) {
        setRecoveryActive(false);
        setError(result.friendlyError || "The password reset link is invalid or has expired.");
      }
    }

    processRecoveryLink();

    if (recoverySession) {
      setRecoveryActive(true);
      setInfo("Your password reset link is active. Please choose a new password.");
      setError("");
    }

    return () => {
      mounted = false;
    };
  }, [handleRecoveryLink, navigate, recoverySession]);

  useEffect(() => {
    if (!loginLockedUntil) {
      setLockoutRemaining(0);
      return undefined;
    }

    function updateRemaining() {
      const remaining = Math.max(0, loginLockedUntil - Date.now());
      setLockoutRemaining(remaining);
      if (remaining === 0) {
        setLoginLockedUntil(0);
        setFailedLoginAttempts(0);
      }
    }

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [loginLockedUntil]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (showResetPrompt) {
      if (!form.email) {
        setError("Please enter your email so we can send the reset link.");
        return;
      }

      setLoading(true);
      const result = await resetPassword(form.email);
      setLoading(false);

      if (result.error) {
        setError(result.friendlyError || result.error.message);
      } else {
        setInfo("If that email exists, a password reset link will be sent shortly.");
      }

      setShowResetPrompt(false);
      return;
    }

    if (recoveryActive) {
      if (newPassword !== confirmNewPassword) {
        setError("Passwords do not match.");
        return;
      }

      const passwordCheck = validatePassword(newPassword);
      if (!passwordCheck.ok) {
        setError(passwordCheck.message);
        return;
      }

      setLoading(true);
      const result = await updatePassword(newPassword);
      setLoading(false);

      if (result.error) {
        setError(result.friendlyError || result.error.message);
        return;
      }

      setNewPassword("");
      setConfirmNewPassword("");
      setRecoveryActive(false);
      setInfo("Password reset successfully. You can continue to your dashboard.");
      navigate("/redirect");
      return;
    }

    if (mode === "login" && loginLockedUntil > Date.now()) {
      setError(`Too many incorrect password attempts. Please wait ${formatLockoutTime(lockoutRemaining)} before trying again.`);
      return;
    }

    if (mode === "signup" && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const result = mode === "login" ? await signIn(form.email, form.password) : await signUp(form);

    setLoading(false);

    if (result.error) {
      if (mode === "login") {
        const nextAttempt = failedLoginAttempts + 1;
        setFailedLoginAttempts(nextAttempt);
        if (nextAttempt <= 5) {
          setError(`Incorrect email or password. You have ${5 - nextAttempt} attempt${5 - nextAttempt === 1 ? "" : "s"} remaining before a temporary login warning.`);
          return;
        }

        const lockoutSeconds = lockoutStage === 0 ? 30 : lockoutStage === 1 ? 60 : 180;
        setLockoutStage((stage) => Math.min(stage + 1, 2));
        setLoginLockedUntil(Date.now() + lockoutSeconds * 1000);
        setError(`Too many incorrect password attempts. Login is paused for ${formatLockoutTime(lockoutSeconds * 1000)}.`);
        return;
      }
      const friendlyMessage = result.friendlyError || result.error.message;
      setError(
        friendlyMessage?.includes("Too many signup emails")
          ? "We’re sending sign-up emails a bit too quickly. Please wait a few minutes, use a different email address, and try again."
          : friendlyMessage
      );
      return;
    }

    if (mode === "signup") {
      if (result.requiresConfirmation) {
        setInfo("Account created successfully. Please check your email and confirm your address before signing in.");
      } else {
        setInfo("Account created successfully. Please check your email and confirm your address before signing in.");
      }
      setForm((f) => ({ ...f, password: "", confirmPassword: "" }));
      setMode("login");
      return;
    }

    setFailedLoginAttempts(0);
    setLockoutStage(0);
    setLoginLockedUntil(0);
    navigate("/redirect");
  }

  function formatLockoutTime(milliseconds) {
    const seconds = Math.max(1, Math.ceil(milliseconds / 1000));
    if (seconds >= 60) return `${Math.ceil(seconds / 60)} minute${Math.ceil(seconds / 60) === 1 ? "" : "s"}`;
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-logo-badge">
            <img src="/logo.png" alt="CSDRepoAI logo" className="auth-logo-image" />
          </div>
          <h1 className="auth-logo-wordmark">CSDRepoAI</h1>
          <p className="auth-logo-subtitle">Notre Dame of Marbel University</p>
        </header>

        <div className="auth-body">
          <div className="auth-tabs" aria-label="Authentication mode">
            <button
              type="button"
              className={`auth-tab${mode === "login" ? " active" : ""}`}
              onClick={() => {
                setMode("login");
                setError("");
                setInfo("");
                setShowResetPrompt(false);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab${mode === "signup" ? " active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError("");
                setInfo("");
                setShowResetPrompt(false);
              }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <h2>{recoveryActive ? "Set a new password" : showResetPrompt ? "Reset your password" : mode === "login" ? "Sign in to your account" : "Create an account"}</h2>
            <p className="auth-form-sub">
              {recoveryActive
                ? "Use the password reset link to choose a new password for your account."
                : showResetPrompt
                  ? "Enter your email and we will send you a password reset link."
                : mode === "login"
                  ? "Use your institutional credentials."
                  : "Register with your role and details below."}
            </p>

            {recoveryActive ? (
              <>
                <Field label="New password">
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="input password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="password-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm new password">
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className="input password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="password-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>
              </>
            ) : mode === "signup" && (
              <>
                <Field label="Full name">
                  <input
                    placeholder="Juan Dela Cruz"
                    value={form.fullName}
                    onChange={update("fullName")}
                    required
                    className="input"
                  />
                </Field>
                <Field label="I am a">
                  <select value={form.role} onChange={update("role")} className="input">
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </Field>
                {form.role === "student" && (
                  <>
                    <Field label="Student number">
                      <input
                        placeholder="e.g. 2021-00123"
                        value={form.studentNumber}
                        onChange={update("studentNumber")}
                        className="input"
                      />
                    </Field>
                    <Field label="Program">
                      <select value={form.program} onChange={update("program")} className="input" required>
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
              </>
            )}

            <Field label="Email">
              <input
                type="email"
                placeholder="you@ndmu.edu.ph"
                value={form.email}
                onChange={update("email")}
                required
                className="input"
              />
            </Field>

            {!showResetPrompt && (mode === "signup" || mode === "login") && (
              <>
                <Field label="Password">
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={form.password}
                      onChange={update("password")}
                      required
                      className="input password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="password-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>
                {mode === "signup" && (
                  <Field label="Confirm password">
                    <div className="password-field">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm password"
                        value={form.confirmPassword}
                        onChange={update("confirmPassword")}
                        required
                        className="input password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="password-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </Field>
                )}
                {mode === "signup" && passwordStrength && (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: "var(--ink-500)" }}>
                      <span>Password strength</span>
                      <strong style={{ color: passwordStrength.color }}>{passwordStrength.label}</strong>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                      <div
                        style={{
                          width: passwordStrength.label === "Weak" ? "25%" : passwordStrength.label === "Medium" ? "50%" : passwordStrength.label === "Strong" ? "75%" : "100%",
                          height: "100%",
                          background: passwordStrength.color,
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            {!recoveryActive && (
              <div className="auth-button-stack">
                <button type="submit" disabled={loading || (mode === "login" && lockoutRemaining > 0)} className="btn btn-primary btn-block">
                  {loading ? "Please wait..." : mode === "login" && lockoutRemaining > 0 ? `Try again in ${formatLockoutTime(lockoutRemaining)}` : showResetPrompt ? "Send Reset Link" : mode === "login" ? "Log In" : "Create Account"}
                </button>
                <div className="auth-links">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "login" ? "signup" : "login");
                      setError("");
                      setInfo("");
                      setShowResetPrompt(false);
                    }}
                    className="auth-switch"
                  >
                    {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
                  </button>
                </div>
                <div className="auth-links">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPrompt((value) => !value);
                      setError("");
                      setInfo("");
                    }}
                    className="auth-switch"
                  >
                    {showResetPrompt ? "Back to sign in" : "Forgot password?"}
                  </button>
                </div>
              </div>
            )}

            {recoveryActive && (
              <>
                <button type="submit" disabled={loading} className="btn btn-primary btn-block">
                  {loading ? "Please wait..." : "Reset Password"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
