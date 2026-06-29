/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// PRODUCTION seed — safe to run on every container boot.
//
// Unlike seed.ts (the demo seed), this NEVER deletes anything and creates NO
// demo users / events / businesses. It only:
//   1. Upserts the activity-type catalog (required so users can create events).
//   2. Ensures one ADMIN account from ADMIN_EMAIL / ADMIN_PASSWORD (idempotent).
//
// docker-compose.prod.yml runs this (not seed.ts) after `prisma migrate deploy`.
// ---------------------------------------------------------------------------
import { ActivityCategory, PrismaClient, Vibe } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TOKEN: Record<ActivityCategory, string> = {
  SPORT: 'act-clay',
  OUTDOOR: 'act-olive',
  SOCIAL: 'act-majorelle',
};

type Cat = ActivityCategory;
// Keep in sync with the CATALOG in seed.ts.
const CATALOG: [slug: string, name: string, icon: string, cat: Cat, vibe: Vibe, outdoor: boolean][] = [
  ['padel', 'Padel', 'Zap', 'SPORT', 'ACTIVE', false],
  ['football', 'Football', 'Goal', 'SPORT', 'ACTIVE', true],
  ['basketball', 'Basketball', 'Dribbble', 'SPORT', 'ACTIVE', false],
  ['beachvolley', 'Beach volleyball', 'CircleDot', 'SPORT', 'ACTIVE', true],
  ['running', 'Running club', 'Activity', 'SPORT', 'ACTIVE', true],
  ['swimming', 'Swimming', 'Droplets', 'SPORT', 'CHILL', false],
  ['yoga', 'Yoga', 'Flower2', 'SPORT', 'CHILL', false],
  ['surfing', 'Surfing', 'Waves', 'OUTDOOR', 'ACTIVE', true],
  ['kitesurf', 'Kitesurfing', 'Wind', 'OUTDOOR', 'ACTIVE', true],
  ['windsurf', 'Windsurfing', 'Sailboat', 'OUTDOOR', 'ACTIVE', true],
  ['hiking', 'Hiking & Trekking', 'Mountain', 'OUTDOOR', 'CHILL', true],
  ['trail', 'Trail running', 'Footprints', 'OUTDOOR', 'ACTIVE', true],
  ['climbing', 'Rock climbing', 'MountainSnow', 'OUTDOOR', 'ACTIVE', true],
  ['cycling', 'Cycling / MTB', 'Bike', 'OUTDOOR', 'ACTIVE', true],
  ['horse', 'Horse riding', 'Trees', 'OUTDOOR', 'CHILL', true],
  ['quad', 'Desert quad & biking', 'Compass', 'OUTDOOR', 'ACTIVE', true],
  ['coffee', 'Coffee meetups', 'Coffee', 'SOCIAL', 'CHILL', false],
  ['boardgames', 'Board game nights', 'Dices', 'SOCIAL', 'CHILL', false],
  ['language', 'Language exchange', 'Languages', 'SOCIAL', 'CHILL', false],
  ['coworking', 'Co-working', 'Laptop', 'SOCIAL', 'CHILL', false],
  ['citywalk', 'City walks', 'Map', 'SOCIAL', 'CHILL', true],
  ['dinner', 'Dinner & foodie', 'UtensilsCrossed', 'SOCIAL', 'CHILL', false],
  ['bookclub', 'Book club', 'BookOpen', 'SOCIAL', 'CHILL', false],
  ['music', 'Live music & jams', 'Music', 'SOCIAL', 'CHILL', false],
  ['art', 'Art & sketch', 'Palette', 'SOCIAL', 'CHILL', false],
  ['volunteering', 'Volunteering', 'HeartHandshake', 'SOCIAL', 'CHILL', true],
  ['photowalk', 'Photo walks', 'Camera', 'SOCIAL', 'CHILL', true],
];

async function main() {
  console.log('Production seed: upserting activity catalog…');
  for (const [slug, name, icon, category, vibe, outdoor] of CATALOG) {
    await prisma.activityType.upsert({
      where: { slug },
      update: {},
      create: { slug, name, icon, category, vibe, outdoor, colorToken: TOKEN[category], isCustom: false },
    });
  }
  console.log(`  catalog ready (${CATALOG.length} activity types).`);

  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    // Create the admin if missing; if the email already exists, just ensure it
    // is an active ADMIN (we never overwrite an existing password here).
    const admin = await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN', status: 'ACTIVE' },
      create: { email, name: 'Admin', passwordHash, role: 'ADMIN', status: 'ACTIVE' },
    });
    console.log(`  admin ready → ${admin.email}`);
  } else {
    console.warn('  ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin bootstrap.');
  }

  console.log('Production seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
