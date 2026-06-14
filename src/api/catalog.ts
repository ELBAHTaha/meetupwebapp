import type { Activity, ActivityCategory, ActivityGroup } from '@/types';

export interface City {
  id: string;
  name: string;
  lat: number;
  lng: number;
  coastal: boolean;
}

export const CITIES: City[] = [
  { id: 'casablanca', name: 'Casablanca', lat: 33.5731, lng: -7.5898, coastal: true },
  { id: 'rabat', name: 'Rabat', lat: 34.0209, lng: -6.8416, coastal: true },
  { id: 'sale', name: 'Salé', lat: 34.0531, lng: -6.7985, coastal: true },
  { id: 'marrakech', name: 'Marrakech', lat: 31.6295, lng: -7.9811, coastal: false },
  { id: 'agadir', name: 'Agadir', lat: 30.4278, lng: -9.5981, coastal: true },
  { id: 'tangier', name: 'Tangier', lat: 35.7595, lng: -5.834, coastal: true },
  { id: 'essaouira', name: 'Essaouira', lat: 31.5085, lng: -9.7595, coastal: true },
  { id: 'taghazout', name: 'Taghazout', lat: 30.5447, lng: -9.709, coastal: true },
];

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  racket: 'Racket',
  water: 'Water',
  team: 'Team',
  outdoor: 'Outdoor',
  fitness: 'Fitness',
  wheels: 'Wheels',
  mind: 'Mind & body',
  social: 'Social & chill',
  other: 'Other',
};

export const GROUP_LABELS: Record<ActivityGroup, string> = {
  sport: 'Sport',
  outdoor: 'Outdoor',
  social: 'Social & chill',
};

// Muted token per group — the whole catalog reads as a restrained 3-tone family.
const groupToken: Record<ActivityGroup, string> = {
  sport: 'act-clay',
  outdoor: 'act-olive',
  social: 'act-majorelle',
};

type SeedDef = [
  id: string,
  name: string,
  lucideIcon: string,
  category: ActivityCategory,
  group: ActivityGroup,
  vibe: Activity['vibe'],
  outdoor: boolean,
];

const DEFS: SeedDef[] = [
  // --- Sport ---
  ['padel', 'Padel', 'Zap', 'racket', 'sport', 'active', false],
  ['football', 'Football', 'Goal', 'team', 'sport', 'active', true],
  ['basketball', 'Basketball', 'Dribbble', 'team', 'sport', 'active', false],
  ['beachvolley', 'Beach volleyball', 'CircleDot', 'team', 'sport', 'active', true],
  ['running', 'Running club', 'Activity', 'fitness', 'sport', 'active', true],
  ['swimming', 'Swimming', 'Droplets', 'water', 'sport', 'chill', false],
  ['yoga', 'Yoga', 'Flower2', 'mind', 'sport', 'chill', false],
  // --- Outdoor ---
  ['surfing', 'Surfing', 'Waves', 'water', 'outdoor', 'active', true],
  ['kitesurf', 'Kitesurfing', 'Wind', 'water', 'outdoor', 'active', true],
  ['windsurf', 'Windsurfing', 'Sailboat', 'water', 'outdoor', 'active', true],
  ['hiking', 'Hiking & Trekking', 'Mountain', 'outdoor', 'outdoor', 'chill', true],
  ['trail', 'Trail running', 'Footprints', 'outdoor', 'outdoor', 'active', true],
  ['climbing', 'Rock climbing', 'MountainSnow', 'outdoor', 'outdoor', 'active', true],
  ['cycling', 'Cycling / MTB', 'Bike', 'wheels', 'outdoor', 'active', true],
  ['horse', 'Horse riding', 'Trees', 'outdoor', 'outdoor', 'chill', true],
  ['quad', 'Desert quad & biking', 'Compass', 'wheels', 'outdoor', 'active', true],
  // --- Social & chill ---
  ['coffee', 'Coffee meetups', 'Coffee', 'social', 'social', 'chill', false],
  ['boardgames', 'Board game nights', 'Dices', 'social', 'social', 'chill', false],
  ['language', 'Language exchange', 'Languages', 'social', 'social', 'chill', false],
  ['coworking', 'Co-working', 'Laptop', 'social', 'social', 'chill', false],
  ['citywalk', 'City walks', 'Map', 'social', 'social', 'chill', true],
  ['dinner', 'Dinner & foodie', 'UtensilsCrossed', 'social', 'social', 'chill', false],
  ['bookclub', 'Book club', 'BookOpen', 'social', 'social', 'chill', false],
  ['music', 'Live music & jams', 'Music', 'social', 'social', 'chill', false],
  ['art', 'Art & sketch', 'Palette', 'social', 'social', 'chill', false],
  ['volunteering', 'Volunteering', 'HeartHandshake', 'social', 'social', 'chill', true],
  ['photowalk', 'Photo walks', 'Camera', 'social', 'social', 'chill', true],
];

export const SEED_ACTIVITIES: Activity[] = DEFS.map(
  ([id, name, lucideIcon, category, group, vibe, outdoor]) => ({
    id,
    name,
    icon: '',
    lucideIcon,
    category,
    group,
    vibe,
    colorToken: groupToken[group],
    outdoor,
    isCustom: false,
  }),
);
