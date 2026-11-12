// src/components/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "@/lib/monitoring";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    captureException(error, {
      source: "react_error_boundary",
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
            Critical Failure
          </p>
          <h1 className="holo-panel p-4 mt-3 text-xl font-black uppercase text-foreground">
            Something went wrong on the battlefield
          </h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            The frontlines hit an unexpected error. Reload to rejoin the fight — your
            progress is saved on the server.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="cta-danger hit-cta px-5 py-2 text-sm font-semibold uppercase tracking-widest transition-colors"
            >
              Reload
            </button>
            <a
              href="/"
              className="min-h-11 inline-flex items-center rounded-md border border-border px-5 py-2 text-sm font-semibold uppercase tracking-widest text-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              Back to base
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
