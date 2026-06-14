import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset?: (id?: string) => void;
    };
  }
}

/** Whether a real Turnstile site key is configured (otherwise CAPTCHA is bypassed). */
export const isTurnstileEnabled = (): boolean => !!SITE_KEY;

/**
 * Cloudflare Turnstile widget. Renders nothing (and is a no-op) when no site key
 * is set — the backend bypasses verification in that case too, so signup still works.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let widgetId: string | undefined;
    const render = () => {
      if (window.turnstile && ref.current && ref.current.childElementCount === 0) {
        widgetId = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      }
    };
    if (window.turnstile) {
      render();
    } else {
      const id = 'cf-turnstile-script';
      let s = document.getElementById(id) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.id = id;
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
      s.addEventListener('load', render);
    }
    return () => {
      if (widgetId && window.turnstile?.reset) {
        try {
          window.turnstile.reset(widgetId);
        } catch {
          /* widget already gone */
        }
      }
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="mt-2 flex justify-center" />;
}
