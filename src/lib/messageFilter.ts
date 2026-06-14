// Mirrors server/src/common/utils/message-filter.ts so mock mode behaves the
// same. Blocks phone numbers, external links, and profanity (social @handles ok).
const PROFANITY = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'bastard', 'slut', 'whore', 'faggot', 'nigger', 'retard',
];
const LINK_RE = /\b(https?:\/\/|www\.)\S+/i;
const DOMAIN_RE = /\b[a-z0-9-]+\.(com|net|org|io|co|me|ly|gg|app|link|info|biz|xyz)\b/i;
const PHONE_RE = /\+?\d(?:[\d\s().-]{5,})\d/;

export function messageViolation(text: string): string | null {
  const digits = (text.match(/\d/g) ?? []).length;
  if (digits >= 7 && PHONE_RE.test(text)) {
    return 'Sharing phone numbers in chat isn’t allowed — keep contact on-platform.';
  }
  if (LINK_RE.test(text) || DOMAIN_RE.test(text)) {
    return 'Links aren’t allowed in chat. Share a social handle (@name) instead.';
  }
  const lower = text.toLowerCase();
  if (PROFANITY.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(lower))) {
    return 'Please keep the chat respectful — that message was blocked.';
  }
  return null;
}
