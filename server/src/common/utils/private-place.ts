// Soft client-/server-side check for private-home venues. Public places only.
const PRIVATE_KEYWORDS = [
  'my place',
  'my apartment',
  'apartment',
  'my home',
  'my flat',
  'my house',
  'rooftop',
  'chez moi',
  'chez nous',
  'villa',
  'riad',
  'home address',
  'my room',
  'private residence',
];

export function looksLikePrivatePlace(...texts: (string | undefined)[]): boolean {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  return PRIVATE_KEYWORDS.some((k) => hay.includes(k));
}

// Activities mentioning alcohol/drugs/explicit content are rejected at creation.
const PROHIBITED_KEYWORDS = [
  'alcohol',
  'alcoholic',
  'beer',
  'beers',
  'wine',
  'vodka',
  'whisky',
  'whiskey',
  'tequila',
  'shots',
  'drunk',
  'booze',
  'pub crawl',
  'weed',
  'cannabis',
  'marijuana',
  'hash',
  'cocaine',
  'drugs',
  'ecstasy',
  'mdma',
  'lsd',
  'nsfw',
  'escort',
  'hookup',
  'sex',
  'nude',
  'naked',
];

/** True when the text mentions alcohol, drugs, or explicit/inappropriate content. */
export function containsProhibitedContent(...texts: (string | undefined)[]): boolean {
  const hay = ` ${texts.filter(Boolean).join(' ').toLowerCase()} `;
  // Word-boundary match so "sex" doesn't trip "Essaouira" etc.
  return PROHIBITED_KEYWORDS.some((k) => new RegExp(`(^|[^a-z])${k.replace(/ /g, '[^a-z]+')}([^a-z]|$)`).test(hay));
}

export function age(birthday: Date): number {
  const now = new Date();
  let a = now.getFullYear() - birthday.getFullYear();
  const m = now.getMonth() - birthday.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthday.getDate())) a--;
  return a;
}
