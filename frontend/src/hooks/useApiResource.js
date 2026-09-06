import { useCallback, useEffect, useRef, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";

/**
 * One GET, with the three states a screen actually has: loading, failed, loaded.
 *
 * Every page used to end its fetch with `.catch(() => setItems([]))`, which
 * turned a dead backend into a calm "No conversations yet." The owner had no
 * way to tell "nothing here" apart from "nothing loaded", so a broken API and
 * an empty account looked identical. This keeps the failure visible and gives
 * the user something to press.
 *
 *   const { data, error, loading, reload } = useApiResource("/tenant/leads");
 *
 * `select` pulls a field out of the response (e.g. r => r.systems). It is held
 * in a ref so passing an inline arrow doesn't re-fire the request every render.
 */
export function useApiResource(path, { select, enabled = true, initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);

  const selectRef = useRef(select);
  selectRef.current = select;

  // Guards against a slow response from an earlier path overwriting a newer one,
  // and against setting state after the component is gone.
  const runId = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!enabled || !path) return;
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(path);
      if (!alive.current || id !== runId.current) return;
      setData(selectRef.current ? selectRef.current(res.data) : res.data);
    } catch (e) {
      if (!alive.current || id !== runId.current) return;
      // A 401 is handled globally in lib/api.js (session ends, redirect to
      // /login) — showing a red error box on a screen that's about to unmount
      // would just be noise.
      if (e?.response?.status !== 401) {
        setError(formatApiErrorDetail(e?.response?.data?.detail) || "Could not load this.");
      }
    } finally {
      if (alive.current && id === runId.current) setLoading(false);
    }
  }, [path, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}
