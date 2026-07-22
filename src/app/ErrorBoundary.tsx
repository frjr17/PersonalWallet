import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error', error.message, info.componentStack);
  }
  render() {
    if (this.state.error)
      return (
        <main className="grid min-h-screen place-items-center p-6">
          <div className="card max-w-lg">
            <p className="eyebrow">Application error</p>
            <h1 className="my-3 font-display text-2xl">This view could not be opened.</h1>
            <p className="mb-5">
              Reload the page. If the problem continues, check your network and Firebase
              configuration.
            </p>
            <Button onClick={() => location.reload()}>Reload</Button>
          </div>
        </main>
      );
    return this.props.children;
  }
}
