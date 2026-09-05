import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

/**
 * The scenario picker inside the hero demo bar.
 *
 * Hand-rolled rather than Radix Select because this listbox opens *upward* over
 * a moving background and shares one seamless glass pill with the call button —
 * a portalled popper fights that on z-index and corner rounding. Kept to the
 * WAI-ARIA listbox pattern: roving active option, full keyboard control, and
 * focus returned to the trigger on close.
 *
 * Scenarios the server hasn't been configured for arrive with `enabled: false`
 * and render as disabled "Soon" rows — the marketing page never offers a call
 * it cannot actually place.
 */
export function ScenarioSelect({ scenarios, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const selected = scenarios.find((s) => s.key === value) || scenarios[0];
  const selectableIndexes = scenarios
    .map((s, i) => (s.enabled ? i : -1))
    .filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const openList = () => {
    if (disabled) return;
    const current = scenarios.findIndex((s) => s.key === value);
    setActiveIndex(current >= 0 && scenarios[current]?.enabled ? current : selectableIndexes[0] ?? 0);
    setOpen(true);
  };

  const commit = (index) => {
    const scenario = scenarios[index];
    if (!scenario?.enabled) return;
    onChange(scenario.key);
    close();
  };

  const step = (direction) => {
    if (!selectableIndexes.length) return;
    const pos = selectableIndexes.indexOf(activeIndex);
    const next =
      pos === -1
        ? selectableIndexes[0]
        : selectableIndexes[
            (pos + direction + selectableIndexes.length) % selectableIndexes.length
          ];
    setActiveIndex(next);
  };

  const onListKeyDown = (e) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        step(-1);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(selectableIndexes[0] ?? 0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(selectableIndexes[selectableIndexes.length - 1] ?? 0);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Tab":
        close(false);
        break;
      default:
        break;
    }
  };

  const onTriggerKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openList();
    }
  };

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="demo-scenario-listbox"
        aria-label="Choose a demo scenario"
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        data-testid="demo-scenario"
        className="flex h-full w-full items-center justify-between gap-3 px-5 text-left text-[15px] text-orbit-cream outline-none transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50 max-[700px]:h-[52px]"
      >
        <span className="truncate">{selected?.label ?? "Choose a scenario"}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-orbit-cream/50 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id="demo-scenario-listbox"
            role="listbox"
            tabIndex={-1}
            aria-label="Demo scenarios"
            aria-activedescendant={`demo-scenario-${scenarios[activeIndex]?.key}`}
            onKeyDown={onListKeyDown}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-full min-w-[248px] overflow-hidden rounded-2xl border border-white/10 bg-[#0C0C10]/92 p-1.5 shadow-[0_28px_80px_rgba(0,0,0,0.6)] outline-none backdrop-blur-2xl"
          >
            {scenarios.map((scenario, i) => {
              const isSelected = scenario.key === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={scenario.key}
                  id={`demo-scenario-${scenario.key}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={!scenario.enabled}
                  onMouseEnter={() => scenario.enabled && setActiveIndex(i)}
                  onClick={() => commit(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-colors ${
                    !scenario.enabled
                      ? "cursor-not-allowed text-orbit-cream/30"
                      : isActive
                      ? "bg-white/[0.09] text-orbit-cream"
                      : "text-orbit-cream/70"
                  }`}
                >
                  <span className="truncate">{scenario.label}</span>
                  {!scenario.enabled ? (
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-orbit-cream/35">
                      Soon
                    </span>
                  ) : (
                    isSelected && <Check className="h-4 w-4 shrink-0 text-orbit-gold" />
                  )}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
