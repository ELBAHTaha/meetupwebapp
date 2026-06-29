import { API_URL } from '@/api/http';

// Crawler-friendly public share URL for an activity. In remote mode this points
// at the backend OG route, which renders a rich WhatsApp/Facebook preview card
// and then redirects human visitors to the public `/a/:id` page. In mock/offline
// mode (no backend) it falls back to the SPA page directly.
export function activityShareUrl(id: string): string {
  return API_URL ? `${API_URL}/share/e/${id}` : `${window.location.origin}/a/${id}`;
}

/** wa.me deep link that pre-fills the WhatsApp message box with `text`. */
export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
