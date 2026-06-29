import { WELCOME_MOSAIC } from '@/lib/imagery';
import { cn } from '@/lib/cn';

// Backdrop for the login / signup screens: a warm photo mosaic of activities
// (coffee, surf, dinner, board games, hiking, music) under a dark wash so the
// white headline + form stay readable. Shows what the app is about — meeting
// people through real-world activities — instead of a single static photo.
//
// `className` controls positioning: `absolute inset-0` (login) or
// `fixed inset-0 -z-10` (signup, so it stays put while the long form scrolls).
export function AuthBackdrop({ className }: { className?: string }) {
  // NOTE: the base + wash use a FIXED warm near-black (#171410), not the `ink`
  // token, on purpose. `ink` flips light↔dark with the theme, which would turn
  // this overlay pale in dark mode and wash out the white text on top. This
  // backdrop is always dark in both themes (like the landing page's dark bands).
  return (
    <div className={cn('overflow-hidden bg-[#171410]', className)} aria-hidden="true">
      <div className="grid h-full w-full grid-cols-2 grid-rows-3 sm:grid-cols-3 sm:grid-rows-2">
        {WELCOME_MOSAIC.map((src, i) => (
          <img key={i} src={src} alt="" loading="lazy" className="h-full w-full object-cover opacity-90" />
        ))}
      </div>
      {/* Warm dark gradient — keeps the brand/headline legible over any tile. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#171410]/60 via-[#171410]/50 to-[#171410]/90" />
    </div>
  );
}
