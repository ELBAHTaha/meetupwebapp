/* eslint-disable no-console */
import { ActivityCategory, PrismaClient, Vibe } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CITY = {
  casablanca: { lat: 33.5731, lng: -7.5898 },
  rabat: { lat: 34.0209, lng: -6.8416 },
  sale: { lat: 34.0531, lng: -6.7985 },
  marrakech: { lat: 31.6295, lng: -7.9811 },
  agadir: { lat: 30.4278, lng: -9.5981 },
  tangier: { lat: 35.7595, lng: -5.834 },
  essaouira: { lat: 31.5085, lng: -9.7595 },
  taghazout: { lat: 30.5447, lng: -9.709 },
};

const TOKEN: Record<ActivityCategory, string> = {
  SPORT: 'act-clay',
  OUTDOOR: 'act-olive',
  SOCIAL: 'act-majorelle',
};

type Cat = ActivityCategory;
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

const days = (n: number, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const hours = (n: number) => new Date(Date.now() + n * 3_600_000);

async function main() {
  console.log('Seeding hudlgo…');

  // ---- Idempotent reset ----
  // The seed creates events/ratings/etc. fresh on every run, so clear that
  // transactional data first to avoid duplicates (the compose stack re-seeds on
  // each boot). Users and the activity catalog below are upserted, so they stay.
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.flag.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.event.deleteMany();
  // Business-side demo data is recreated each run too (venue slugs are unique).
  await prisma.venueReview.deleteMany();
  await prisma.venue.deleteMany(); // cascades venueClaim
  await prisma.business.deleteMany(); // cascades members, verifications, sponsorships

  // ---- Activity catalog ----
  const types: Record<string, string> = {};
  for (const [slug, name, icon, category, vibe, outdoor] of CATALOG) {
    const t = await prisma.activityType.upsert({
      where: { slug },
      update: {},
      create: { slug, name, icon, category, vibe, outdoor, colorToken: TOKEN[category], isCustom: false },
    });
    types[slug] = t.id;
  }

  // ---- Users ----
  const pw = await bcrypt.hash('password123', 10);
  const USERS: {
    key: string; email: string; name: string; city: keyof typeof CITY; zip: string; neighborhood: string;
    bio: string; gender: 'MALE' | 'FEMALE' | 'OTHER'; admin?: boolean; lookingFor?: 'FRIENDS' | 'ACTIVITIES' | 'BOTH';
    birthday: string; verified?: boolean;
  }[] = [
    { key: 'u1', email: 'you@jmaa.app', name: 'You', city: 'casablanca', zip: '20330', neighborhood: 'Maârif', bio: 'Padel addict, weekend surfer, always down for a kickabout.', gender: 'MALE', admin: true, lookingFor: 'BOTH', birthday: '1994-05-15', verified: true },
    { key: 'u2', email: 'yasmine@jmaa.app', name: 'Yasmine El Fassi', city: 'marrakech', zip: '40000', neighborhood: 'Guéliz', bio: 'Yoga teacher & trail runner. The Atlas is my gym.', gender: 'FEMALE', lookingFor: 'BOTH', birthday: '1992-03-10', verified: true },
    { key: 'u3', email: 'omar@jmaa.app', name: 'Omar Benani', city: 'taghazout', zip: '80022', neighborhood: 'Taghazout village', bio: 'Surf instructor. Pop-up specialist.', gender: 'MALE', lookingFor: 'ACTIVITIES', birthday: '1990-07-01', verified: true },
    { key: 'u4', email: 'lena@jmaa.app', name: 'Lena Müller', city: 'essaouira', zip: '44000', neighborhood: 'Skala', bio: 'Traveling through Morocco for 3 months.', gender: 'FEMALE', lookingFor: 'FRIENDS', birthday: '1996-09-20' },
    { key: 'u5', email: 'karim@jmaa.app', name: 'Karim Tazi', city: 'rabat', zip: '10080', neighborhood: 'Agdal', bio: '5-a-side organiser, basketball on Sundays.', gender: 'MALE', lookingFor: 'ACTIVITIES', birthday: '1991-06-20', verified: true },
    { key: 'u6', email: 'sofia@jmaa.app', name: 'Sofia Alaoui', city: 'casablanca', zip: '20180', neighborhood: 'Aïn Diab', bio: 'Climber & cyclist. Corniche every morning.', gender: 'FEMALE', lookingFor: 'BOTH', birthday: '1993-11-02' },
    { key: 'u7', email: 'mehdi@jmaa.app', name: 'Mehdi Chraibi', city: 'agadir', zip: '80000', neighborhood: 'Founty', bio: 'Kitesurf when it blows, beach volley when it doesn’t.', gender: 'MALE', lookingFor: 'ACTIVITIES', birthday: '1990-08-05', verified: true },
    { key: 'u8', email: 'nadia@jmaa.app', name: 'Nadia Bennis', city: 'tangier', zip: '90000', neighborhood: 'Malabata', bio: 'Running club lead & sea swimmer all year round.', gender: 'FEMALE', lookingFor: 'BOTH', birthday: '1989-05-12', verified: true },
    { key: 'u9', email: 'tom@jmaa.app', name: 'Tom Becker', city: 'taghazout', zip: '80022', neighborhood: 'Hash Point', bio: 'Digital nomad. Here for the surf.', gender: 'MALE', lookingFor: 'FRIENDS', birthday: '1995-05-20' },
    { key: 'u10', email: 'hicham@jmaa.app', name: 'Hicham Ouali', city: 'marrakech', zip: '40000', neighborhood: 'Palmeraie', bio: 'Desert guide. The dunes are calling.', gender: 'MALE', lookingFor: 'ACTIVITIES', birthday: '1988-04-18', verified: true },
  ];

  const uid: Record<string, string> = {};
  for (const u of USERS) {
    const c = CITY[u.city];
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: pw,
        name: u.name,
        bio: u.bio,
        neighborhood: u.neighborhood,
        zip: u.zip,
        lat: c.lat,
        lng: c.lng,
        gender: u.gender,
        birthday: new Date(u.birthday),
        lookingFor: u.lookingFor ?? 'BOTH',
        role: u.admin ? 'ADMIN' : 'USER',
        status: 'ACTIVE',
        verified: u.verified ?? false,
      },
    });
    uid[u.key] = created.id;
  }

  // Demo host-tier subscriptions so pricing/analytics show real Bronze/Silver/Gold tiers.
  const demoPlans: [string, 'BRONZE' | 'SILVER' | 'GOLD'][] = [
    ['u1', 'GOLD'],
    ['u3', 'SILVER'],
    ['u5', 'BRONZE'],
  ];
  for (const [key, plan] of demoPlans) {
    if (!uid[key]) continue;
    await prisma.user.update({
      where: { id: uid[key] },
      data: { subscriptionPlan: plan, subscriptionStatus: 'ACTIVE', subscriptionEndsAt: new Date(Date.now() + 30 * 86_400_000) },
    });
  }

  // Helper to create an event (+ chat thread) with attendees.
  async function event(opts: {
    id: string; host: string; type: string; title: string; city: keyof typeof CITY; label: string; address: string;
    startsAt: Date; durationMin: number; max: number; min?: number; price?: number; gender?: 'ANY' | 'WOMEN' | 'MEN';
    desc?: string; attendees?: string[]; status?: 'LIVE' | 'COMPLETED'; chatMessages?: { from: string; text: string; at: Date }[];
    online?: boolean; meetingUrl?: string;
  }) {
    const c = CITY[opts.city];
    const endsAt = new Date(opts.startsAt.getTime() + opts.durationMin * 60000);
    const e = await prisma.event.create({
      data: {
        hostId: uid[opts.host],
        activityTypeId: types[opts.type],
        title: opts.title,
        description: opts.desc ?? '',
        locationLabel: opts.label,
        address: opts.address,
        lat: c.lat + (Math.random() - 0.5) * 0.04,
        lng: c.lng + (Math.random() - 0.5) * 0.04,
        isPublicPlace: true,
        isOnline: opts.online ?? false,
        meetingUrl: opts.online ? opts.meetingUrl ?? 'https://meet.google.com/jmaa-demo' : null,
        startsAt: opts.startsAt,
        endsAt,
        maxAttendees: opts.max,
        minPlayers: opts.min ?? 1,
        price: opts.price ?? 0,
        genderPreference: opts.gender ?? 'ANY',
        status: opts.status ?? 'LIVE',
        approvedAt: new Date(), // seed activities are pre-approved demo data
        chatThread: { create: { expiresAt: new Date(endsAt.getTime() + 86_400_000) } },
        attendances: { create: (opts.attendees ?? []).map((k) => ({ userId: uid[k], status: 'JOINED' as const })) },
      },
      include: { chatThread: true },
    });
    if (opts.chatMessages && e.chatThread) {
      for (const m of opts.chatMessages) {
        await prisma.chatMessage.create({
          data: { threadId: e.chatThread.id, senderId: uid[m.from], text: m.text, sentAt: m.at },
        });
      }
    }
    return e.id;
  }

  // ---- Live future events ----
  const e1 = await event({ id: 'e1', host: 'u1', type: 'padel', title: 'Friday night padel', city: 'casablanca', label: 'Padel Club Anfa', address: 'Bd de l’Océan Atlantique, Anfa', startsAt: days(2, 20), durationMin: 90, max: 4, min: 4, price: 120, desc: 'Doubles, courts booked. Cold drinks after.', attendees: ['u5', 'u6'] });
  await event({ id: 'e2', host: 'u3', type: 'surfing', title: 'Dawn patrol at Anchor Point', city: 'taghazout', label: 'Anchor Point', address: 'Taghazout Bay', startsAt: days(1, 7), durationMin: 120, max: 8, desc: 'Clean lines forecast. All levels who can paddle out.', attendees: ['u9', 'u4', 'u7'] });
  await event({ id: 'e3', host: 'u5', type: 'football', title: '5-a-side Sunday league', city: 'rabat', label: 'Stade Moulay Abdellah', address: 'Av. Al Mansour Addahbi', startsAt: days(3, 18), durationMin: 60, max: 10, min: 8, price: 40, desc: 'Two teams, friendly but competitive.', attendees: ['u1', 'u6', 'u8', 'u7'] });
  await event({ id: 'e4', host: 'u2', type: 'yoga', title: 'Sunrise vinyasa in the Menara', city: 'marrakech', label: 'Menara Gardens', address: 'Av. de la Menara', startsAt: days(1, 7), durationMin: 75, max: 15, price: 80, desc: 'Gentle flow as the sun comes up. Tea after.', gender: 'WOMEN', attendees: ['u4', 'u6'] });
  await event({ id: 'e5', host: 'u7', type: 'kitesurf', title: 'Agadir Bay kite session', city: 'agadir', label: 'Agadir Bay', address: 'Corniche d’Agadir', startsAt: days(2, 15), durationMin: 150, max: 6, desc: '20+ knots forecast. Independent riders only.', attendees: ['u3'] });
  await event({ id: 'e6', host: 'u8', type: 'running', title: 'Tangier coastal run + sea swim', city: 'tangier', label: 'Malabata Beach', address: 'Av. Mohammed VI', startsAt: days(1, 8), durationMin: 75, max: 20, desc: 'Easy 6k then a dip for the brave.', attendees: ['u4'] });
  await event({ id: 'e7', host: 'u6', type: 'coffee', title: 'Saturday coffee & good conversation', city: 'casablanca', label: 'Café Bahia, Maârif', address: 'Rue Jean Jaurès, Maârif', startsAt: days(2, 11), durationMin: 90, max: 8, desc: 'No agenda — just nice people and good coffee.', attendees: ['u1', 'u4'] });
  await event({ id: 'e8', host: 'u1', type: 'language', title: 'Darija ↔ English language exchange', city: 'casablanca', label: 'Café Bahia, Maârif', address: 'Rue Jean Jaurès, Maârif', startsAt: days(3, 19), durationMin: 90, max: 12, min: 4, desc: 'Swap a language, make a friend.', attendees: ['u4'] });
  await event({ id: 'e9', host: 'u5', type: 'boardgames', title: 'Board game night — Catan & chill', city: 'rabat', label: 'Boardwalk Café', address: 'Av. Fal Ould Oumeir', startsAt: days(4, 20), durationMin: 150, max: 10, min: 4, price: 30, desc: 'Settlers, Codenames, Uno for the brave.', attendees: ['u6'] });
  await event({ id: 'e-online', host: 'u2', type: 'language', title: 'Online Darija practice (video call)', city: 'casablanca', label: 'Online', address: 'Online', startsAt: days(2, 19), durationMin: 60, max: 12, min: 4, desc: 'Practice Darija over a video call — beginners welcome. Link shared with people who join.', attendees: ['u4', 'u6'], online: true });
  await event({ id: 'e10', host: 'u2', type: 'dinner', title: 'Foodie meetup — street eats crawl', city: 'marrakech', label: 'Jemaa el-Fna', address: 'Place Jemaa el-Fna', startsAt: days(5, 20), durationMin: 150, max: 8, min: 3, price: 150, desc: 'We eat our way across the medina.', attendees: ['u4', 'u10'] });
  await event({ id: 'e11', host: 'u10', type: 'quad', title: 'Sunset quad through the Palmeraie', city: 'marrakech', label: 'Palmeraie', address: 'Circuit de la Palmeraie', startsAt: days(6, 17), durationMin: 120, max: 8, min: 2, price: 350, attendees: ['u4', 'u9'] });
  await event({ id: 'e12', host: 'u4', type: 'photowalk', title: 'Essaouira photo walk — blue & white', city: 'essaouira', label: 'Essaouira ramparts', address: 'Skala de la Ville', startsAt: days(6, 16), durationMin: 120, max: 10, attendees: ['u9', 'u7'] });

  // ---- Just-ended event (open chat) hosted by You ----
  const justEnded = await event({
    id: 'e13', host: 'u1', type: 'coffee', title: 'Maârif coffee & catch-up', city: 'casablanca',
    label: 'Café Bahia, Maârif', address: 'Rue Jean Jaurès, Maârif', startsAt: hours(-2), durationMin: 90, max: 8,
    status: 'COMPLETED', attendees: ['u4', 'u6', 'u9'],
    chatMessages: [
      { from: 'u1', text: 'Table booked at Café Bahia, see you at 11 ☕', at: hours(-3) },
      { from: 'u4', text: 'On my way!', at: hours(-2.5) },
      { from: 'u6', text: 'Lovely catching up everyone 🙌', at: hours(-1) },
    ],
  });

  // ---- Past events (for ratings; chats already expired) ----
  const pastSurf = await event({ id: 'p1', host: 'u3', type: 'surfing', title: 'Taghazout weekend surf', city: 'taghazout', label: 'Anchor Point', address: 'Taghazout Bay', startsAt: days(-6, 8), durationMin: 120, max: 8, status: 'COMPLETED', attendees: ['u1', 'u9', 'u4'] });
  const pastFoot = await event({ id: 'p2', host: 'u5', type: 'football', title: 'Rabat 5-a-side', city: 'rabat', label: 'Stade Moulay Abdellah', address: 'Av. Al Mansour Addahbi', startsAt: days(-2, 18), durationMin: 60, max: 10, min: 8, price: 40, status: 'COMPLETED', attendees: ['u1', 'u6', 'u8', 'u9', 'u7'] });
  const pastPadel = await event({ id: 'p3', host: 'u1', type: 'padel', title: 'Midweek padel doubles', city: 'casablanca', label: 'Padel Club Anfa', address: 'Anfa', startsAt: days(-4, 20), durationMin: 90, max: 4, min: 4, price: 120, status: 'COMPLETED', attendees: ['u5', 'u6', 'u4'] });

  // ---- Ratings (private) + flags → makes u9 (Tom) flagged ----
  await prisma.rating.createMany({
    data: [
      { eventId: pastSurf, fromUserId: uid.u3, toUserId: uid.u9, score: 2, type: 'HOST_TO_ATTENDEE' },
      { eventId: pastFoot, fromUserId: uid.u5, toUserId: uid.u9, score: 2, type: 'HOST_TO_ATTENDEE' },
      { eventId: pastSurf, fromUserId: uid.u1, toUserId: uid.u3, score: 5, type: 'ATTENDEE_TO_HOST' },
      { eventId: pastFoot, fromUserId: uid.u9, toUserId: uid.u5, score: 5, type: 'ATTENDEE_TO_HOST' },
      { eventId: pastPadel, fromUserId: uid.u5, toUserId: uid.u1, score: 5, type: 'ATTENDEE_TO_HOST' },
      { eventId: pastPadel, fromUserId: uid.u4, toUserId: uid.u1, score: 5, type: 'ATTENDEE_TO_HOST' },
    ],
  });
  await prisma.flag.createMany({
    data: [
      { userId: uid.u9, eventId: pastSurf, reason: 'Low rating (2★) at "Taghazout weekend surf"' },
      { userId: uid.u9, eventId: pastFoot, reason: 'Low rating (2★) at "Rabat 5-a-side"' },
    ],
  });

  // Recompute trust scores for everyone (simple aggregate).
  const allRatings = await prisma.rating.groupBy({ by: ['toUserId'], _avg: { score: true } });
  for (const r of allRatings) {
    const flags = await prisma.flag.findMany({ where: { userId: r.toUserId }, select: { eventId: true } });
    await prisma.user.update({
      where: { id: r.toUserId },
      data: { trustScore: Number((r._avg.score ?? 5).toFixed(2)), flagCount: new Set(flags.map((f) => f.eventId)).size },
    });
  }

  // ---- Reports (open) ----
  await prisma.report.createMany({
    data: [
      { reporterId: uid.u5, targetType: 'USER', targetUserId: uid.u9, reason: 'No-show and rude in the group chat.', status: 'OPEN' },
      { reporterId: uid.u8, targetType: 'USER', targetUserId: uid.u9, reason: 'Made others uncomfortable at the meetup.', status: 'OPEN' },
      { reporterId: uid.u4, targetType: 'EVENT', targetEventId: pastFoot, reason: 'Location looked like a private address.', status: 'OPEN' },
    ],
  });

  // ---- A few notifications for You ----
  await prisma.notification.createMany({
    data: [
      { userId: uid.u1, type: 'rate', title: 'How was it?', body: 'Rate the people you met at “Maârif coffee & catch-up”.', eventId: justEnded },
      { userId: uid.u1, type: 'reminder', title: 'Your meetup is tomorrow', body: 'Dawn patrol at Anchor Point — see who’s going.' },
    ],
  });

  // ---- Business side (Foundation) ----
  // A verified business with a claimed venue + two unclaimed (LISTED) venues,
  // plus a dedicated business-owner login.
  const cc = CITY.casablanca;
  const bizOwner = await prisma.user.upsert({
    where: { email: 'venue@jmaa.app' },
    update: {},
    create: {
      email: 'venue@jmaa.app',
      passwordHash: pw,
      name: 'Anfa Padel Club',
      bio: 'We run Casablanca’s friendliest padel courts.',
      neighborhood: 'Anfa',
      zip: '20050',
      lat: cc.lat,
      lng: cc.lng,
      gender: 'OTHER',
      lookingFor: 'ACTIVITIES',
      role: 'BUSINESS',
      status: 'ACTIVE',
      verified: false,
    },
  });

  const business = await prisma.business.create({
    data: {
      name: 'Anfa Padel Club',
      legalName: 'Anfa Padel Club SARL',
      category: 'sports_venue',
      description: 'Indoor and outdoor padel courts, café and pro shop on the Casablanca corniche.',
      address: 'Bd de l’Océan Atlantique, Anfa, Casablanca',
      lat: cc.lat,
      lng: cc.lng,
      contactEmail: 'venue@jmaa.app',
      phone: '+212 522 000 000',
      website: 'https://anfapadel.example',
      status: 'VERIFIED',
      verifiedAt: new Date(),
      businessTosAcceptedAt: new Date(),
      ownerId: bizOwner.id,
      members: { create: { userId: bizOwner.id, role: 'OWNER', status: 'ACTIVE' } },
    },
  });

  const claimedVenue = await prisma.venue.create({
    data: {
      businessId: business.id,
      name: 'Padel Club Anfa',
      slug: 'padel-club-anfa',
      category: 'sports_venue',
      description: 'Six glass courts, floodlit, with a café overlooking the Atlantic.',
      address: 'Bd de l’Océan Atlantique, Anfa, Casablanca',
      lat: cc.lat,
      lng: cc.lng,
      amenities: ['Parking', 'Café', 'Showers', 'Pro shop'],
      hours: { mon: '08:00–23:00', sat: '07:00–00:00', sun: '07:00–22:00' },
      phone: '+212 522 000 000',
      website: 'https://anfapadel.example',
      status: 'VERIFIED',
    },
  });

  // Attach the existing padel event to the claimed venue + a review from an attendee.
  await prisma.event.update({ where: { id: e1 }, data: { venueId: claimedVenue.id } });
  await prisma.venueReview.create({
    data: { venueId: claimedVenue.id, userId: uid.u5, rating: 5, text: 'Great courts and a friendly crowd.', attendedEventId: e1 },
  });
  {
    const agg = await prisma.venueReview.aggregate({ where: { venueId: claimedVenue.id, status: 'VISIBLE' }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.venue.update({ where: { id: claimedVenue.id }, data: { avgRating: agg._avg.rating ?? 0, reviewCount: agg._count._all } });
  }

  // Two unclaimed LISTED venues that businesses can later claim.
  await prisma.venue.createMany({
    data: [
      { name: 'Boardwalk Café', slug: 'boardwalk-cafe-rabat', category: 'cafe', address: 'Av. Fal Ould Oumeir, Agdal, Rabat', lat: CITY.rabat.lat, lng: CITY.rabat.lng, status: 'LISTED' },
      { name: 'Menara Gardens Pavilion', slug: 'menara-gardens-pavilion', category: 'outdoor', address: 'Av. de la Menara, Marrakech', lat: CITY.marrakech.lat, lng: CITY.marrakech.lng, status: 'LISTED' },
    ],
  });

  console.log('\nSeed complete.');
  console.log('Admin login →  email: you@jmaa.app   password: password123');
  console.log('Business owner →  email: venue@jmaa.app   password: password123');
  console.log('All seed users share the password: password123\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
