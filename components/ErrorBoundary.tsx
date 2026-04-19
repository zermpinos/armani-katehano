import { Component, ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl px-5 py-6 border border-ak-border bg-ak-surface text-center text-ak-text-dim">
          <div className="text-[28px] mb-2">⚠️</div>
          <div className="text-[13px] font-bold text-ak-text">
            {this.props.label ?? "This section failed to load"}
          </div>
          <div className="text-xs mt-1">
            Try refreshing the page. If the problem persists, contact support.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
