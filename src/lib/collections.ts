import { isToday } from 'date-fns';
import type { EnrichedEvent } from '@/types';

export interface Collection {
  id: string;
  label: string;
  /** lucide icon key (rendered as a line icon). */
  icon: string;
  predicate: (e: EnrichedEvent) => boolean;
}

// Airbnb-style intent collections — discovery by mood, not just by sport.
export const COLLECTIONS: Collection[] = [
  {
    id: 'tonight',
    label: 'Free tonight',
    icon: 'Moon',
    predicate: (e) => isToday(new Date(e.startsAt)) && new Date(e.startsAt).getHours() >= 17,
  },
  {
    id: 'coffee',
    label: 'Coffee & conversation',
    icon: 'Coffee',
    predicate: (e) => ['coffee', 'language', 'dinner', 'bookclub'].includes(e.activityId),
  },
  {
    id: 'moving',
    label: 'Get moving',
    icon: 'Activity',
    predicate: (e) => e.activity.vibe === 'active',
  },
  {
    id: 'newintown',
    label: 'New in town',
    icon: 'Sparkles',
    predicate: (e) => e.travelersWelcome && e.activity.group === 'social',
  },
  {
    id: 'travelers',
    label: 'Travelers welcome',
    icon: 'Plane',
    predicate: (e) => e.travelersWelcome,
  },
  {
    id: 'chill',
    label: 'Chill & social',
    icon: 'Sofa',
    predicate: (e) => e.activity.vibe === 'chill' || e.activity.group === 'social',
  },
];

export const VIBE_LABEL: Record<'chill' | 'active', string> = {
  chill: 'Chill',
  active: 'Active',
};
