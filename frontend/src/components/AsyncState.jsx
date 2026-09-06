import { Loader2, RefreshCw, AlertCircle } from "lucide-react";

/** Centred spinner for a section that is still fetching. */
export function Loading({ className = "" }) {
  return (
    <div className={`p-10 grid place-items-center ${className}`} data-testid="section-loading">
      <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
    </div>
  );
}

/**
 * What the user sees when a fetch fails.
 *
 * The point is that it is unmistakably NOT an empty state: it names the
 * failure and offers a way out. "No leads yet" on a broken API is how ORBIT
 * ended up looking like every button was dead.
 */
export function LoadError({ error, onRetry, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center ${className}`}
      data-testid="section-error"
    >
      <AlertCircle className="w-5 h-5 mx-auto text-amber-600" strokeWidth={1.8} />
      <p className="mt-3 text-sm font-medium text-amber-900">This didn&apos;t load</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
        {typeof error === "string" ? error : "Something went wrong reaching ORBIT."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          data-testid="section-retry"
          className="mt-4 inline-flex items-center gap-2 h-9 rounded-full border border-amber-300 bg-white px-4 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      )}
    </div>
  );
}
