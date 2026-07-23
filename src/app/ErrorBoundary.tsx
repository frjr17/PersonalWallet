import { Component, type ReactNode } from 'react';
import { logError } from '@/lib/errors';
import { Button } from '@/components/ui/button';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logError('error-boundary', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-xl font-semibold">Something broke</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page hit an unexpected error. Your data is safe — reload to continue.
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </main>
    );
  }
}
