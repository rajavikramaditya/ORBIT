import { Component } from "react";

/**
 * Catches render errors anywhere below it and shows what broke.
 *
 * Without this, a single bad property access unmounts the entire React tree and
 * the user gets a blank white page with nothing in the UI to explain it — which
 * is exactly the failure that made ORBIT look like "every button is broken".
 * A crash is still a bug, but it should never be a silent one.
 *
 * The reset button clears the error state rather than reloading, so a transient
 * render failure doesn't cost the user their place; "Reload page" is there for
 * when the app is genuinely wedged.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    // When the route changes, give the app a fresh start: a crash on one page
    // shouldn't leave the error screen stuck over a page the user navigated to.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null });
    }
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Keep it in the console too — this is what a developer looks for first.
    // eslint-disable-next-line no-console
    console.error("ORBIT crashed while rendering:", error, info?.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    // Only ever show the raw stack outside production. In production it can leak
    // internals into a screenshot a customer sends us.
    const showDetail = process.env.NODE_ENV !== "production";

    return (
      <div className="min-h-screen grid place-items-center bg-zinc-50 p-6" data-testid="app-error">
        <div className="w-full max-w-lg rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Something broke on this screen
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            This is a fault on our side, not something you did. Your data is safe — nothing was
            saved or changed.
          </p>

          <p className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 font-mono text-[13px] text-zinc-700">
            {String(error?.message || error)}
          </p>

          {showDetail && info?.componentStack && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-zinc-500">
                Component stack
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
                {info.componentStack.trim()}
              </pre>
            </details>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null, info: null })}
              className="h-10 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              data-testid="app-error-retry"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 rounded-full border border-black/10 px-5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Reload page
            </button>
            <a
              href="/dashboard"
              className="grid h-10 place-items-center rounded-full px-5 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
