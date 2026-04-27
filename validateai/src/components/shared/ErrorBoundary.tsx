import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error inesperado',
    };
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0F] px-4">
          <div className="max-w-md w-full bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-2">Algo salió mal</h2>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-6 font-mono bg-gray-50 dark:bg-[#0A0A0F] rounded-lg p-3">
              {this.state.message}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-teal-500 text-white font-semibold rounded-xl
                           hover:bg-teal-600 transition text-sm"
              >
                Intentar de nuevo
              </button>
              <button
                onClick={() => window.location.replace('/')}
                className="px-5 py-2.5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8B8AA0] font-medium
                           rounded-xl hover:bg-gray-50 dark:bg-[#0A0A0F] transition text-sm"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
