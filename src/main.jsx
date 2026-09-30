import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
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
