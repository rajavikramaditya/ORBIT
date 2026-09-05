import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ElevenLabs from "@elevenlabs/react";
import { api, formatApiErrorDetail } from "@/lib/api";

/**
 * Voice-demo session state for the public landing page.
 *
 * The browser never holds an agent id or a provider credential. It asks ORBIT's
 * own API for a scenario catalogue, and — when the visitor starts a call — for a
 * single short-lived session URL (POST /api/public/demo/session). Everything
 * provider-specific lives on the server (AGENT.md rules 4 and 6).
 *
 * The SDK's provider component is looked up defensively: newer releases require
 * wrapping the tree in `ConversationProvider`, older ones don't export it at all.
 * Resolving it at runtime means a dependency bump can't turn the landing page
 * into a blank screen.
 */
export const ConversationProvider =
  ElevenLabs.ConversationProvider || (({ children }) => children);

const MAX_TURNS = 4;

export const DEMO_STATE = {
  LOADING: "loading",
  UNAVAILABLE: "unavailable",
  IDLE: "idle",
  STARTING: "starting",
  LIVE: "live",
  ERROR: "error",
};

export function useDemoSession() {
  const [scenarios, setScenarios] = useState([]);
  const [scenarioKey, setScenarioKey] = useState(null);
  const [state, setState] = useState(DEMO_STATE.LOADING);
  const [errorMessage, setErrorMessage] = useState("");
  const [turns, setTurns] = useState([]);
  const [seconds, setSeconds] = useState(0);

  // `state` is read inside SDK callbacks that close over their first render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const pushTurn = useCallback((role, text) => {
    const clean = typeof text === "string" ? text.trim() : "";
    if (!clean) return;
    setTurns((prev) => [...prev, { role, text: clean }].slice(-MAX_TURNS));
  }, []);

  const conversation = ElevenLabs.useConversation({
    onMessage: (message) => {
      // Shape has shifted across SDK versions; accept the known spellings.
      const text = message?.message ?? message?.text ?? "";
      const source = message?.source ?? message?.role;
      pushTurn(source === "user" ? "user" : "agent", text);
    },
    onDisconnect: () => {
      // A provider-side drop should land on the idle bar, not a dead UI.
      if (stateRef.current === DEMO_STATE.LIVE || stateRef.current === DEMO_STATE.STARTING) {
        setState(DEMO_STATE.IDLE);
      }
    },
    onError: () => {
      setErrorMessage("The demo call dropped. Please try again.");
      setState(DEMO_STATE.ERROR);
    },
  });

  // ---- Scenario catalogue -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    api
      .get("/public/demo/scenarios")
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data?.scenarios) ? data.scenarios : [];
        setScenarios(list);
        const firstEnabled = list.find((s) => s.enabled);
        if (firstEnabled) {
          setScenarioKey(firstEnabled.key);
          setState(DEMO_STATE.IDLE);
        } else {
          setState(DEMO_STATE.UNAVAILABLE);
        }
      })
      .catch(() => {
        // No demo configured, or the API is unreachable. Either way the page
        // falls back to a plain CTA instead of showing a broken control.
        if (!cancelled) setState(DEMO_STATE.UNAVAILABLE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Call timer ---------------------------------------------------------
  useEffect(() => {
    if (state !== DEMO_STATE.LIVE) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.key === scenarioKey) || null,
    [scenarios, scenarioKey]
  );

  const start = useCallback(async () => {
    if (!scenarioKey) return;
    setErrorMessage("");
    setTurns([]);
    setSeconds(0);
    setState(DEMO_STATE.STARTING);

    // Ask for the microphone first: a denial here should never burn a paid
    // session, and the browser prompt is clearer before anything else happens.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setErrorMessage("Microphone access is needed for the live demo.");
      setState(DEMO_STATE.ERROR);
      return;
    }

    let sessionUrl;
    try {
      const { data } = await api.post("/public/demo/session", { scenario: scenarioKey });
      sessionUrl = data?.session_url;
    } catch (err) {
      const status = err?.response?.status;
      setErrorMessage(
        status === 429
          ? "You've just tried the demo. Please give it a few minutes."
          : status === 503
          ? "The live demo is offline right now."
          : formatApiErrorDetail(err?.response?.data?.detail)
      );
      setState(DEMO_STATE.ERROR);
      return;
    }

    if (!sessionUrl) {
      setErrorMessage("Could not start the demo. Please try again.");
      setState(DEMO_STATE.ERROR);
      return;
    }

    try {
      await conversation.startSession({ signedUrl: sessionUrl });
      setState(DEMO_STATE.LIVE);
    } catch {
      setErrorMessage("Could not connect the call. Please try again.");
      setState(DEMO_STATE.ERROR);
    }
  }, [conversation, scenarioKey]);

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      /* already closed — fall through to the idle state either way */
    }
    setState(DEMO_STATE.IDLE);
    setTurns([]);
    setSeconds(0);
  }, [conversation]);

  const dismissError = useCallback(() => {
    setErrorMessage("");
    setState(scenarioKey ? DEMO_STATE.IDLE : DEMO_STATE.UNAVAILABLE);
  }, [scenarioKey]);

  const getOutputData = useCallback(() => {
    try {
      return conversation.getOutputByteFrequencyData?.() ?? null;
    } catch {
      return null;
    }
  }, [conversation]);

  // Stop a call if the visitor navigates away mid-conversation.
  useEffect(
    () => () => {
      conversation.endSession?.().catch?.(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    state,
    scenarios,
    scenarioKey,
    setScenarioKey,
    activeScenario,
    turns,
    seconds,
    errorMessage,
    isAgentSpeaking: Boolean(conversation.isSpeaking),
    start,
    stop,
    dismissError,
    getOutputData,
  };
}

export function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
