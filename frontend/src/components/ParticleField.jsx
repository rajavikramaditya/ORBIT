import { useEffect, useState, useMemo } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const ParticleField = () => {
  const [ready, setReady] = useState(false);
  const reduced = prefersReduced();

  useEffect(() => {
    if (reduced) return;
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, [reduced]);

  const options = useMemo(
    () => ({
      fpsLimit: 60,
      fullScreen: { enable: false },
      detectRetina: true,
      background: { color: "transparent" },
      particles: {
        number: { value: 42, density: { enable: true, area: 900 } },
        color: { value: "#9ca3af" },
        links: { enable: true, distance: 150, color: "#c4c4cc", opacity: 0.28, width: 1 },
        move: { enable: true, speed: 0.45, outModes: { default: "bounce" } },
        opacity: { value: 0.35 },
        size: { value: { min: 1, max: 2.4 } },
      },
      interactivity: {
        events: { onHover: { enable: true, mode: "grab" }, resize: true },
        modes: { grab: { distance: 170, links: { opacity: 0.5 } } },
      },
    }),
    []
  );

  if (reduced || !ready) return null;
  return <Particles id="tsparticles" options={options} className="absolute inset-0 -z-0" />;
};
