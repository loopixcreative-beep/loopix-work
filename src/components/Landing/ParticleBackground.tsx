import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { Engine, ISourceOptions } from '@tsparticles/engine';

// Must be a stable reference across renders — ParticlesProvider throws if its
// `init` prop changes identity, so this is defined once at module scope.
const initEngine = async (engine: Engine) => {
  await loadSlim(engine);
};

const cssColor = (variable: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value ? `hsl(${value})` : fallback;
};

const ParticleCanvas = () => {
  const { resolvedTheme } = useTheme();

  // The `key={resolvedTheme}` below remounts this component on theme change,
  // which re-runs this memo fresh — so it only needs to compute once per mount.
  const options = useMemo<ISourceOptions>(() => {
    const primary = cssColor('--primary', '#2563eb');
    const orange = cssColor('--brand-orange', '#f97316');
    const linkColor = cssColor('--muted-foreground', '#94a3b8');

    return {
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      detectRetina: true,
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'grab' },
          resize: { enable: true },
        },
        modes: {
          grab: { distance: 150, links: { opacity: 0.5 } },
        },
      },
      particles: {
        number: { value: 46, density: { enable: true, width: 1200, height: 800 } },
        color: { value: [primary, orange] },
        links: { enable: true, color: linkColor, distance: 130, opacity: 0.18, width: 1 },
        move: {
          enable: true,
          speed: 0.5,
          direction: 'none',
          random: true,
          straight: false,
          outModes: { default: 'out' },
        },
        opacity: { value: 0.35 },
        size: { value: { min: 1, max: 2.6 } },
      },
    };
  }, []);

  return (
    <Particles id="hero-particles" key={resolvedTheme} options={options} className="absolute inset-0" />
  );
};

/** A quiet, mouse-reactive particle network for the hero background. */
export const ParticleBackground = () => (
  <ParticlesProvider init={initEngine}>
    <ParticleCanvas />
  </ParticlesProvider>
);
