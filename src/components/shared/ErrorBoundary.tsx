import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this value changes (e.g. the route path) a crashed boundary resets itself. */
  resetKey?: unknown;
  /** "Go to collections" handler. Defaults to a full navigation. */
  onNavigateHome?: () => void;
  /** Full-screen layout for the root boundary; inline for the page outlet. */
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    const { onNavigateHome } = this.props;
    this.setState({ error: null });
    if (onNavigateHome) onNavigateHome();
    else window.location.assign('/collections');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorFallback
        error={error}
        fullScreen={this.props.fullScreen}
        onReload={this.handleReload}
        onHome={this.handleHome}
      />
    );
  }
}
