import { Component, type ReactNode, type ErrorInfo } from 'react';
import { captureError } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  label?: string;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary:${this.props.label ?? 'unknown'}]`,
      error.message,
      info.componentStack?.slice(0, 300),
    );
    captureError(error, {
      boundary: this.props.label ?? 'unknown',
      componentStack: info.componentStack?.slice(0, 500),
    });
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return this.props.fallback ?? (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center space-y-3">
        <svg
          className="w-8 h-8 text-red-400/60 mx-auto"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <div>
          <p className="text-sm font-semibold text-red-400">
            {this.props.label ? `${this.props.label} no disponible` : 'Error al cargar componente'}
          </p>
          <p className="text-xs text-red-400/50 mt-1 font-mono">
            {this.state.error.message.slice(0, 120)}
          </p>
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          className="text-xs text-red-400/70 hover:text-red-400 underline underline-offset-2 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }
}
