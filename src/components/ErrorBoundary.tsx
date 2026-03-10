import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-md px-6">
            <div className="text-[32px] select-none">⚠</div>
            <h2 className="text-[16px] font-medium">Something went wrong</h2>
            <p className="font-mono text-[12px] text-muted-foreground leading-relaxed">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="h-[32px] px-4 gallery-border text-[12px] font-mono hover:bg-secondary transition-colors"
            >
              Try again
            </button>
            <div>
              <button
                onClick={() => window.location.assign("/")}
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Return to projects
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
