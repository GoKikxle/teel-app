import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Top-level safety net for the "pages get completely stuck, nothing
// works, until I hard-refresh" reports from UAT — the app had zero error
// boundaries anywhere, so any render-time throw (an unexpected data
// shape, a null reference) unmounted the whole tree with no visible
// feedback, leaving a blank page. This can't fix whatever specific bug
// threw, but it turns "blank page, no way out" into "an actual message
// plus a reload button," for that failure mode and any other rendering
// bug like it, known or not. See useAuth.tsx for the other major
// contributor (an auth bootstrap that could hang forever with no
// timeout, blocking `ready` — and every page gated on it — permanently).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="modal-backdrop">
          <div className="modal-viewport">
            <div className="modal-card">
              <h2>Something went wrong</h2>
              <p className="lede" style={{ marginBottom: 20 }}>
                This page hit an error it couldn't recover from. Reloading usually fixes it.
              </p>
              <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
