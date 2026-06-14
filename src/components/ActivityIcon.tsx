import {
  Activity as ActivityLucide,
  Bike,
  BookOpen,
  Camera,
  CircleDot,
  Coffee,
  Compass,
  Dices,
  Dribbble,
  Droplets,
  Flower2,
  Footprints,
  Goal,
  HeartHandshake,
  Languages,
  Laptop,
  Map as MapGlyph,
  Mountain,
  MountainSnow,
  Music,
  Palette,
  Sailboat,
  Sparkles,
  Trees,
  UtensilsCrossed,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Activity } from '@/types';
import { activityColor } from '@/lib/activityColors';
import { cn } from '@/lib/cn';

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Zap, Waves, Goal, Mountain, Footprints, MountainSnow, Wind, Sailboat,
  CircleDot, Dribbble, Activity: ActivityLucide, Bike, Flower2, Droplets,
  Compass, Sparkles, Trees, Coffee, Dices, Languages, Laptop, Map: MapGlyph,
  UtensilsCrossed, BookOpen, Music, Palette, HeartHandshake, Camera,
};

export function resolveIcon(key?: string): LucideIcon {
  return (key && ICON_REGISTRY[key]) || Sparkles;
}

type IconSize = 'sm' | 'md' | 'lg' | 'xl';

const tileSizes: Record<IconSize, string> = {
  sm: 'h-8 w-8 rounded-[9px]',
  md: 'h-10 w-10 rounded-[10px]',
  lg: 'h-12 w-12 rounded-card',
  xl: 'h-14 w-14 rounded-card',
};
const glyphSizes: Record<IconSize, string> = {
  sm: 'h-[18px] w-[18px]',
  md: 'h-5 w-5',
  lg: 'h-[22px] w-[22px]',
  xl: 'h-6 w-6',
};

interface Props {
  activity: Activity;
  size?: IconSize;
  /** Render inside a muted tinted tile (accent glyph) vs. a bare line glyph. */
  tile?: boolean;
  className?: string;
}

export function ActivityIcon({ activity, size = 'md', tile = false, className }: Props) {
  const color = activityColor(activity.colorToken);
  const Glyph = resolveIcon(activity.lucideIcon);

  if (!tile) {
    return <Glyph className={cn(glyphSizes[size], 'text-ink-soft', className)} strokeWidth={1.5} aria-hidden />;
  }
  return (
    <div className={cn('flex shrink-0 items-center justify-center', tileSizes[size], color.bgSoft, className)} aria-hidden>
      <Glyph className={cn(glyphSizes[size], color.text)} strokeWidth={1.6} />
    </div>
  );
}
