/**
 * components/ErrorBoundary.js
 * Catches rendering errors in a subtree and shows a fallback
 * instead of white-screening the entire page.
 */
import { Component } from "react";
import { C } from "../lib/theme";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          borderRadius: 12,
          padding: "24px 20px",
          border: `1px solid ${C.border}`,
          background: C.surface,
          textAlign: "center",
          color: C.textDim,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {this.props.label ?? "This section failed to load"}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Try refreshing the page. If the problem persists, contact support.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
