import type { Vibe } from '@/types';
import { Tag } from './Chip';
import { VIBE_LABEL } from '@/lib/collections';

/** Small, quiet label conveying the feel of an activity. */
export function VibeTag({ vibe }: { vibe: Vibe }) {
  return (
    <Tag className={vibe === 'chill' ? 'bg-majorelle-soft text-majorelle' : 'bg-clay-soft text-clay'}>
      {VIBE_LABEL[vibe]}
    </Tag>
  );
}
