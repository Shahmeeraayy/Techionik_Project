import type { CSSProperties } from 'react';

export const technicianPageBackgroundStyle: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 18% 18%, rgba(74, 222, 128, 0.16), transparent 22%), radial-gradient(circle at 82% 14%, rgba(45, 212, 191, 0.14), transparent 24%), linear-gradient(145deg, #03101a 0%, #082033 50%, #0a2419 100%)',
};

export const technicianGridOverlayStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '120px 120px',
  backgroundPosition: '-1px -1px',
};

export const technicianOrbitalGlowStyle: CSSProperties = {
  background:
    'radial-gradient(circle at 50% 0%, rgba(74,222,128,0.24), rgba(74,222,128,0) 52%), radial-gradient(circle at 78% 18%, rgba(45,212,191,0.18), rgba(45,212,191,0) 38%)',
};

export const technicianDisplayFontStyle: CSSProperties = {
  fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};

export const technicianBodyFontStyle: CSSProperties = {
  fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};
