import { LookingFor, Prisma, User } from '@prisma/client';

// Map our enum to the frontend's lowercase union and back.
export function lookingForOut(v: LookingFor): 'partners' | 'friends' | 'both' {
  if (v === 'FRIENDS') return 'friends';
  if (v === 'ACTIVITIES') return 'partners';
  return 'both';
}
export function lookingForIn(v?: string): LookingFor | undefined {
  if (v === 'friends') return 'FRIENDS';
  if (v === 'partners') return 'ACTIVITIES';
  if (v === 'both') return 'BOTH';
  return undefined;
}

const ZIP_CITY: Record<string, string> = {
  '20': 'Casablanca',
  '10': 'Rabat',
  '11': 'Salé',
  '40': 'Marrakech',
  '80': 'Agadir',
  '90': 'Tangier',
  '44': 'Essaouira',
};

export function cityFromZip(zip?: string | null, fallback?: string | null): string {
  if (zip && ZIP_CITY[zip.slice(0, 2)]) return ZIP_CITY[zip.slice(0, 2)];
  return fallback ?? 'Casablanca';
}

function avatarFor(u: Pick<User, 'photoUrl' | 'name'>): string {
  if (u.photoUrl) return u.photoUrl;
  const seed = encodeURIComponent(u.name || 'jmaa');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=ffd5b3,c0aede,d1d4f9,b6e3f4,ffdfbf`;
}

type UserWithRels = User & {
  userActivities?: { activityType: { slug: string }; level: string }[];
  _count?: { ratingsReceived?: number };
  businessesOwned?: { id: string }[];
};

/** Public profile shape — never includes private contact/rating detail. */
export function publicUser(u: UserWithRels) {
  return {
    id: u.id,
    name: u.name,
    avatar: avatarFor(u),
    bio: u.bio ?? '',
    city: cityFromZip(u.zip, u.neighborhood),
    neighborhood: u.neighborhood ?? undefined,
    verified: u.verified,
    rating: Number(u.trustScore),
    reviewCount: u._count?.ratingsReceived ?? 0,
    trustScore: Number(u.trustScore),
    flagCount: u.flagCount,
    badges: [] as string[],
    isTraveler: false,
    lookingFor: lookingForOut(u.lookingFor),
    status: u.status.toLowerCase() as 'active' | 'suspended' | 'banned',
    role: u.role.toLowerCase() as 'user' | 'admin' | 'business',
    subscriptionPlan: u.subscriptionPlan.toLowerCase(),
    subscriptionStatus: u.subscriptionStatus.toLowerCase(),
    subscriptionEndsAt: u.subscriptionEndsAt ? u.subscriptionEndsAt.toISOString() : undefined,
    isPremiumUser: u.isPremiumUser,
    premiumUntil: u.premiumUntil ? u.premiumUntil.toISOString() : undefined,
    creditAmountCents: u.creditAmountCents,
    activities:
      u.userActivities?.map((ua) => ({ activityId: ua.activityType.slug, level: ua.level })) ?? [],
    joinedAt: u.createdAt.toISOString(),
  };
}

/** Private "me" shape — adds contact fields for the owner only. */
export function meUser(u: UserWithRels) {
  return {
    ...publicUser(u),
    email: u.email,
    phone: u.phone ?? undefined,
    cardLastFour: u.cardLastFour ?? undefined,
    zip: u.zip ?? undefined,
    birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : undefined,
    suspendedUntil: u.suspendedUntil ? u.suspendedUntil.toISOString() : undefined,
    verificationStatus: u.verificationStatus.toLowerCase() as 'none' | 'pending' | 'approved' | 'rejected',
    emailNotifications: u.emailNotifications,
    // Present when this account owns a sponsored venue — drives the business UI.
    businessId: u.businessesOwned?.[0]?.id ?? undefined,
  };
}

export const userPublicInclude = {
  userActivities: { include: { activityType: { select: { slug: true } } } },
  _count: { select: { ratingsReceived: true } },
  businessesOwned: { select: { id: true }, take: 1 },
} satisfies Prisma.UserInclude;
