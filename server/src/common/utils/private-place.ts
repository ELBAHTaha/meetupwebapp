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

export function age(birthday: Date): number {
  const now = new Date();
  let a = now.getFullYear() - birthday.getFullYear();
  const m = now.getMonth() - birthday.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthday.getDate())) a--;
  return a;
}
