import type { CSSProperties } from 'react';

export const technicianPageBackgroundStyle: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 16% 18%, rgba(79, 124, 255, 0.22), transparent 22%), radial-gradient(circle at 82% 14%, rgba(79, 124, 255, 0.14), transparent 24%), radial-gradient(circle at 70% 78%, rgba(121, 161, 255, 0.12), transparent 26%), linear-gradient(145deg, #080c14 0%, #0d1422 48%, #111b2f 100%)',
};

export const technicianGridOverlayStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '120px 120px',
  backgroundPosition: '-1px -1px',
};

export const technicianOrbitalGlowStyle: CSSProperties = {
  background:
    'radial-gradient(circle at 50% 0%, rgba(79,124,255,0.3), rgba(79,124,255,0) 52%), radial-gradient(circle at 78% 18%, rgba(121,161,255,0.18), rgba(121,161,255,0) 38%)',
};

export const technicianDisplayFontStyle: CSSProperties = {
  fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};

export const technicianBodyFontStyle: CSSProperties = {
  fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};
