// Muted, earthy accent system. The whole catalog reads as a restrained tonal
// family (clay / olive / slate-blue) — never a rainbow. Each token returns
// static Tailwind classes + a raw hex for Leaflet markers.

export interface ActivityColor {
  hex: string;
  bgSoft: string; // tinted background
  text: string; // accent text
  bgSolid: string; // solid accent background (rare — primary actions only)
  border: string;
}

const COLORS: Record<string, ActivityColor> = {
  'act-clay': {
    hex: '#C2502E',
    bgSoft: 'bg-clay-soft',
    text: 'text-clay',
    bgSolid: 'bg-clay',
    border: 'border-clay/30',
  },
  'act-olive': {
    hex: '#5F6342',
    bgSoft: 'bg-olive-soft',
    text: 'text-olive',
    bgSolid: 'bg-olive',
    border: 'border-olive/30',
  },
  'act-majorelle': {
    hex: '#2E5A87',
    bgSoft: 'bg-majorelle-soft',
    text: 'text-majorelle',
    bgSolid: 'bg-majorelle',
    border: 'border-majorelle/30',
  },
  'act-saffron': {
    hex: '#D89A34',
    bgSoft: 'bg-saffron-soft',
    text: 'text-saffron',
    bgSolid: 'bg-saffron',
    border: 'border-saffron/30',
  },
};

const FALLBACK = COLORS['act-clay'];

export function activityColor(colorToken: string): ActivityColor {
  return COLORS[colorToken] ?? FALLBACK;
}
