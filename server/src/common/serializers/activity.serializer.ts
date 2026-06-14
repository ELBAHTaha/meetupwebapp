import { ActivityCategory, ActivityType, Vibe } from '@prisma/client';

const GROUP_TOKEN: Record<ActivityCategory, string> = {
  SPORT: 'act-clay',
  OUTDOOR: 'act-olive',
  SOCIAL: 'act-majorelle',
};

// The frontend has both a granular `category` and a high-level `group`.
// We store the high-level one; map it back to a valid granular value.
function granular(cat: ActivityCategory): string {
  if (cat === 'SOCIAL') return 'social';
  if (cat === 'OUTDOOR') return 'outdoor';
  return 'other';
}

export function colorTokenFor(cat: ActivityCategory): string {
  return GROUP_TOKEN[cat];
}

/** Map a DB ActivityType to the frontend `Activity` shape. */
export function serializeActivity(t: ActivityType) {
  return {
    id: t.slug,
    name: t.name,
    icon: '', // legacy emoji slot — no longer rendered
    lucideIcon: t.icon,
    category: granular(t.category),
    group: t.category.toLowerCase() as 'sport' | 'outdoor' | 'social',
    vibe: t.vibe.toLowerCase() as 'chill' | 'active',
    colorToken: t.colorToken,
    outdoor: t.outdoor,
    isCustom: t.isCustom,
    createdBy: t.createdById ?? undefined,
  };
}

export function vibeIn(v: string): Vibe {
  return v === 'active' ? 'ACTIVE' : 'CHILL';
}

export function categoryIn(group: string): ActivityCategory {
  if (group === 'outdoor') return 'OUTDOOR';
  if (group === 'social') return 'SOCIAL';
  return 'SPORT';
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || `activity-${Date.now()}`
  );
}
