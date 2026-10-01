import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const CHUNK_RELOAD_KEY = "csdrepoai:chunk-reload-at";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  try {
    const now = Date.now();
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (now - lastReload > 30_000) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
      window.location.reload();
    }
  } catch {
    // Keep the import error visible when browser storage is unavailable.
  }
});

class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "An unexpected error occurred while starting the app.",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[app] UI render failed:", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f6f4ef",
          color: "#14213d",
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
        }}>
          <section>
            <h1 style={{ fontFamily: "'Source Serif 4', serif" }}>CSDRepoAI could not load this page</h1>
            <p>Please reload the site. If the problem continues, contact the repository administrator.</p>
            <details style={{ margin: "16px auto", maxWidth: 640, textAlign: "left" }}>
              <summary style={{ cursor: "pointer" }}>Technical details</summary>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{this.state.errorMessage}</pre>
            </details>
            <button type="button" onClick={() => window.location.reload()}>Reload page</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
