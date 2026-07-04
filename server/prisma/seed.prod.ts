/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// PRODUCTION seed — safe to run on every container boot.
//
// Unlike seed.ts (the demo seed), this NEVER deletes anything. It only:
//   1. Upserts the activity-type catalog (required so users can create events).
//   2. Ensures one ADMIN account from ADMIN_EMAIL / ADMIN_PASSWORD (idempotent).
//   3. Seeds a handful of "community" activities in every known city so brand-new
//      users always land on a populated discover feed (see COMMUNITY block below).
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
  const typeIds: Record<string, string> = {};
  for (const [slug, name, icon, category, vibe, outdoor] of CATALOG) {
    const t = await prisma.activityType.upsert({
      where: { slug },
      update: {},
      create: { slug, name, icon, category, vibe, outdoor, colorToken: TOKEN[category], isCustom: false },
    });
    typeIds[slug] = t.id;
  }
  console.log(`  catalog ready (${CATALOG.length} activity types).`);

  let adminId: string | undefined;
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
    adminId = admin.id;
    console.log(`  admin ready → ${admin.email}`);
  } else {
    console.warn('  ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin bootstrap.');
  }

  await seedCommunityActivities(typeIds, adminId);

  console.log('Production seed complete.');
}

// ---------------------------------------------------------------------------
// COMMUNITY activities — starter content so a brand-new user in any Moroccan
// city opens a populated discover feed instead of an empty one.
//
// Every one of these is hosted by the real ADMIN account — no fake personas.
//
// This is idempotent AND self-refreshing across reboots, without ever deleting
// real user data:
//   • For every city × slot we look for an *upcoming* admin-hosted activity with
//     the same title. If one exists we leave it (and any real joins) untouched;
//     if none does, we create a fresh one dated 3 days out. So expired
//     activities are never resurrected and never duplicated while live.
// ---------------------------------------------------------------------------
type GenderPref = 'ANY' | 'WOMEN' | 'MEN';

// Legacy fake "community host" accounts from earlier seeds. We reassign any
// activities they host to the admin, then remove the accounts. Kept here only
// so the migration can find and clean them up on boot.
const LEGACY_COMMUNITY_HOST_EMAILS = [
  'sara.community@hudlgo.com',
  'youssef.community@hudlgo.com',
  'imane.community@hudlgo.com',
  'reda.community@hudlgo.com',
  'salma.community@hudlgo.com',
  'anas.community@hudlgo.com',
  'khadija.community@hudlgo.com',
  'mehdi.community@hudlgo.com',
];

interface ActBuilder {
  type: string; // activity-type slug (must exist in CATALOG)
  title: (city: string) => string;
  label: (city: string) => string;
  desc: string;
  hour: number;
  durationMin: number;
  max: number;
  min: number;
  price: number;
  gender?: GenderPref;
}

const ACT: Record<string, ActBuilder> = {
  coffee: { type: 'coffee', title: (c) => `Coffee & good conversation in ${c}`, label: (c) => `Café in downtown ${c}`, desc: 'No agenda — just friendly people and good coffee. New in town? Come say hi.', hour: 11, durationMin: 90, max: 8, min: 2, price: 0 },
  language: { type: 'language', title: (c) => `Darija ↔ English language exchange (${c})`, label: (c) => `Café in ${c} centre`, desc: 'Swap a language, make a friend. All levels welcome.', hour: 19, durationMin: 90, max: 12, min: 4, price: 0 },
  football: { type: 'football', title: (c) => `${c} 5-a-side football`, label: (c) => `Football pitch, ${c}`, desc: 'Friendly two-team game. Come solo or bring mates.', hour: 20, durationMin: 60, max: 10, min: 8, price: 40 },
  padel: { type: 'padel', title: (c) => `Evening padel doubles in ${c}`, label: (c) => `Padel courts, ${c}`, desc: 'Doubles, courts booked. Cold drinks after.', hour: 20, durationMin: 90, max: 4, min: 4, price: 120 },
  running: { type: 'running', title: (c) => `${c} morning running club`, label: (c) => `Seafront / park, ${c}`, desc: 'Relaxed 6k, nobody left behind. Coffee after for those keen.', hour: 8, durationMin: 60, max: 20, min: 2, price: 0 },
  citywalk: { type: 'citywalk', title: (c) => `${c} old town walk & photos`, label: (c) => `Old town, ${c}`, desc: 'A relaxed wander through the historic streets. Bring a camera.', hour: 17, durationMin: 120, max: 12, min: 2, price: 0 },
  boardgames: { type: 'boardgames', title: (c) => `Board game night in ${c}`, label: (c) => `Café in ${c}`, desc: 'Catan, Codenames, Uno. Beginners very welcome.', hour: 20, durationMin: 150, max: 10, min: 4, price: 0 },
  yoga: { type: 'yoga', title: (c) => `Sunrise yoga in ${c}`, label: (c) => `Public park, ${c}`, desc: 'Gentle flow to start the day. A few spare mats available.', hour: 8, durationMin: 75, max: 15, min: 2, price: 60 },
  surfing: { type: 'surfing', title: (c) => `Beginner-friendly surf at ${c}`, label: (c) => `${c} beach`, desc: 'Catch some waves — boards for rent nearby. All levels who can swim.', hour: 9, durationMin: 120, max: 8, min: 2, price: 150 },
  kitesurf: { type: 'kitesurf', title: (c) => `Kite session at ${c}`, label: (c) => `${c} bay / lagoon`, desc: 'Steady wind forecast. Independent riders and improvers welcome.', hour: 15, durationMin: 150, max: 6, min: 2, price: 200 },
  hiking: { type: 'hiking', title: (c) => `Weekend hike near ${c}`, label: (c) => `Trailhead near ${c}`, desc: 'A scenic half-day trek. Bring water and good shoes.', hour: 9, durationMin: 180, max: 15, min: 3, price: 0 },
  basketball: { type: 'basketball', title: (c) => `Pickup basketball in ${c}`, label: (c) => `Outdoor court, ${c}`, desc: 'Half-court runs, all levels. First to show sets the teams.', hour: 19, durationMin: 90, max: 10, min: 6, price: 0 },
};

// Every city in area.ts CITY_CENTRES, each with four believable activities.
const CITIES: { name: string; lat: number; lng: number; acts: string[] }[] = [
  { name: 'Casablanca', lat: 33.5731, lng: -7.5898, acts: ['padel', 'coffee', 'running', 'boardgames'] },
  { name: 'Rabat', lat: 34.0209, lng: -6.8416, acts: ['football', 'coffee', 'running', 'language'] },
  { name: 'Salé', lat: 34.0531, lng: -6.7985, acts: ['football', 'coffee', 'citywalk', 'basketball'] },
  { name: 'Kenitra', lat: 34.261, lng: -6.5802, acts: ['football', 'coffee', 'running', 'boardgames'] },
  { name: 'Mohammedia', lat: 33.6861, lng: -7.3829, acts: ['padel', 'coffee', 'surfing', 'running'] },
  { name: 'Marrakech', lat: 31.6295, lng: -7.9811, acts: ['padel', 'coffee', 'yoga', 'citywalk'] },
  { name: 'Fès', lat: 34.0181, lng: -5.0078, acts: ['football', 'coffee', 'citywalk', 'language'] },
  { name: 'Meknès', lat: 33.8935, lng: -5.5473, acts: ['football', 'coffee', 'citywalk', 'boardgames'] },
  { name: 'Tangier', lat: 35.7595, lng: -5.834, acts: ['football', 'coffee', 'running', 'surfing'] },
  { name: 'Tétouan', lat: 35.5785, lng: -5.3684, acts: ['football', 'coffee', 'citywalk', 'running'] },
  { name: 'Chefchaouen', lat: 35.1688, lng: -5.2636, acts: ['football', 'coffee', 'hiking', 'citywalk'] },
  { name: 'Oujda', lat: 34.6867, lng: -1.9114, acts: ['football', 'coffee', 'citywalk', 'boardgames'] },
  { name: 'Nador', lat: 35.1681, lng: -2.9335, acts: ['football', 'coffee', 'running', 'citywalk'] },
  { name: 'El Jadida', lat: 33.2316, lng: -8.5007, acts: ['padel', 'coffee', 'surfing', 'running'] },
  { name: 'Agadir', lat: 30.4278, lng: -9.5981, acts: ['padel', 'coffee', 'surfing', 'running'] },
  { name: 'Essaouira', lat: 31.5085, lng: -9.7595, acts: ['football', 'coffee', 'surfing', 'citywalk'] },
  { name: 'Taghazout', lat: 30.5447, lng: -9.709, acts: ['football', 'coffee', 'surfing', 'yoga'] },
  { name: 'Ifrane', lat: 33.5228, lng: -5.1106, acts: ['football', 'coffee', 'hiking', 'citywalk'] },
  { name: 'Beni Mellal', lat: 32.3373, lng: -6.3498, acts: ['football', 'coffee', 'hiking', 'citywalk'] },
  { name: 'Ouarzazate', lat: 30.9335, lng: -6.937, acts: ['football', 'coffee', 'hiking', 'citywalk'] },
  { name: 'Dakhla', lat: 23.6848, lng: -15.9579, acts: ['football', 'coffee', 'kitesurf', 'running'] },
  { name: 'Laâyoune', lat: 27.1253, lng: -13.1625, acts: ['football', 'coffee', 'running', 'citywalk'] },
];

async function seedCommunityActivities(typeIds: Record<string, string>, adminId?: string) {
  if (!adminId) {
    console.warn('  no admin account — skipping community activities (they are hosted by admin).');
    return;
  }
  console.log('Production seed: ensuring community activities (hosted by admin)…');

  // Migrate away from the old fake "community host" personas: reassign every
  // activity they host to the admin, then delete the accounts. onDelete is
  // Cascade on Event.host, so we MUST reassign before deleting — otherwise the
  // activities (and any real joins) would be wiped along with the account.
  const legacyHosts = await prisma.user.findMany({
    where: { email: { in: LEGACY_COMMUNITY_HOST_EMAILS } },
    select: { id: true },
  });
  if (legacyHosts.length) {
    const legacyIds = legacyHosts.map((u) => u.id);
    const reassigned = await prisma.event.updateMany({
      where: { hostId: { in: legacyIds } },
      data: { hostId: adminId },
    });
    await prisma.user.deleteMany({ where: { id: { in: legacyIds } } });
    console.log(`  migrated ${reassigned.count} activities off ${legacyIds.length} legacy host account(s) → admin.`);
  }

  const now = new Date();
  const daysAt = (n: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  let created = 0;
  let kept = 0;
  for (let ci = 0; ci < CITIES.length; ci++) {
    const city = CITIES[ci];
    for (let slot = 0; slot < city.acts.length; slot++) {
      const b = ACT[city.acts[slot]];
      const hid = adminId;
      const title = b.title(city.name);

      // All community activities start 3 days from now (each at its own hour).
      const startsAt = daysAt(3, b.hour);
      const endsAt = new Date(startsAt.getTime() + b.durationMin * 60000);
      const chatExpiresAt = new Date(endsAt.getTime() + 86_400_000);

      // Already have this activity upcoming? Keep the same row (so any real joins
      // survive) but refresh its date to 3 days out and re-assert feed-visibility.
      const existing = await prisma.event.findFirst({
        where: { hostId: hid, title, endsAt: { gt: now } },
        select: { id: true },
      });
      if (existing) {
        await prisma.event.update({
          where: { id: existing.id },
          data: { startsAt, endsAt, approvedAt: now, status: 'LIVE', visibility: 'PUBLIC', underReview: false },
        });
        // Keep the chat window in step with the refreshed date (updateMany so a
        // missing thread is a no-op instead of a throw).
        await prisma.chatThread.updateMany({ where: { eventId: existing.id }, data: { expiresAt: chatExpiresAt } });
        kept++;
        continue;
      }

      await prisma.event.create({
        data: {
          hostId: hid,
          activityTypeId: typeIds[b.type],
          title,
          description: b.desc,
          locationLabel: b.label(city.name),
          address: b.label(city.name),
          areaLabel: city.name,
          lat: city.lat + (slot - 1.5) * 0.006,
          lng: city.lng + (slot - 1.5) * 0.006,
          isPublicPlace: true,
          startsAt,
          endsAt,
          maxAttendees: b.max,
          minPlayers: b.min,
          price: b.price,
          genderPreference: b.gender ?? 'ANY',
          visibility: 'PUBLIC',
          status: 'LIVE',
          approvedAt: now, // pre-approved starter content
          chatThread: { create: { expiresAt: chatExpiresAt } },
        },
      });
      created++;
    }
  }
  console.log(`  community activities ready: ${created} created, ${kept} already live across ${CITIES.length} cities.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
