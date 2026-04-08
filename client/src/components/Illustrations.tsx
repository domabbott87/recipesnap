/**
 * Food line-art illustrations from the RecipeSnap pitch deck.
 * Blue strokes on transparent background — place on white cards.
 * For yellow backgrounds, use stroke="white".
 */

interface IllusProps {
  stroke?: string;
  size?: number;
  className?: string;
}

const s = (stroke: string) => ({ stroke, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

/** Noodle bowl with chopsticks */
export function NoodleBowl({ stroke = "#2338FF", size = 80, className = "" }: IllusProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Bowl */}
      <path d="M12 38 Q12 62 40 62 Q68 62 68 38 Z" strokeWidth="3" {...s(stroke)} />
      {/* Rim */}
      <ellipse cx="40" cy="38" rx="28" ry="6" strokeWidth="3" {...s(stroke)} />
      {/* Noodles */}
      <path d="M24 38 Q30 32 36 38 Q42 44 48 38 Q54 32 60 38" strokeWidth="2.5" {...s(stroke)} />
      <path d="M20 42 Q28 36 34 42 Q40 48 46 42 Q52 36 58 42" strokeWidth="2" {...s(stroke)} />
      {/* Chopsticks */}
      <line x1="32" y1="10" x2="22" y2="36" strokeWidth="3" {...s(stroke)} />
      <line x1="42" y1="8" x2="30" y2="36" strokeWidth="3" {...s(stroke)} />
    </svg>
  );
}

/** Tomato */
export function Tomato({ stroke = "#2338FF", size = 80, className = "" }: IllusProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <circle cx="40" cy="46" r="24" strokeWidth="3" {...s(stroke)} />
      {/* Stem */}
      <path d="M40 22 Q40 14 44 10" strokeWidth="3" {...s(stroke)} />
      {/* Leaves */}
      <path d="M40 22 Q34 12 26 14 Q30 20 40 22" strokeWidth="2.5" {...s(stroke)} />
      <path d="M40 22 Q46 12 54 14 Q50 20 40 22" strokeWidth="2.5" {...s(stroke)} />
      {/* Highlight */}
      <path d="M52 36 Q56 42 54 50" strokeWidth="2" opacity="0.5" {...s(stroke)} />
    </svg>
  );
}

/** Carrot */
export function Carrot({ stroke = "#2338FF", size = 80, className = "" }: IllusProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Body */}
      <path d="M50 12 Q62 16 60 36 L42 66 Q38 70 36 66 L30 36 Q28 14 40 10 Z" strokeWidth="3" {...s(stroke)} />
      {/* Texture lines */}
      <line x1="34" y1="28" x2="58" y2="24" strokeWidth="1.5" {...s(stroke)} />
      <line x1="32" y1="40" x2="56" y2="36" strokeWidth="1.5" {...s(stroke)} />
      <line x1="34" y1="52" x2="52" y2="50" strokeWidth="1.5" {...s(stroke)} />
      {/* Leaves */}
      <path d="M42 10 Q36 2 28 6" strokeWidth="2.5" {...s(stroke)} />
      <path d="M42 10 Q44 2 52 4" strokeWidth="2.5" {...s(stroke)} />
      <path d="M42 10 Q38 4 42 0" strokeWidth="2" {...s(stroke)} />
    </svg>
  );
}

/** Sandwich / burger */
export function Sandwich({ stroke = "#2338FF", size = 80, className = "" }: IllusProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Top bun */}
      <path d="M16 36 Q16 18 40 16 Q64 18 64 36 Z" strokeWidth="3" {...s(stroke)} />
      {/* Bottom bun */}
      <rect x="14" y="54" width="52" height="10" rx="5" strokeWidth="3" {...s(stroke)} />
      {/* Lettuce */}
      <path d="M14 50 Q22 44 30 50 Q38 44 46 50 Q54 44 66 50" strokeWidth="2.5" {...s(stroke)} />
      {/* Patty */}
      <rect x="16" y="42" width="48" height="8" rx="2" strokeWidth="2.5" {...s(stroke)} />
      {/* Sesame seeds */}
      <circle cx="30" cy="26" r="2" {...s(stroke)} strokeWidth="1.5" />
      <circle cx="40" cy="22" r="2" {...s(stroke)} strokeWidth="1.5" />
      <circle cx="50" cy="26" r="2" {...s(stroke)} strokeWidth="1.5" />
    </svg>
  );
}

/** Chef's knife */
export function ChefKnife({ stroke = "#2338FF", size = 80, className = "" }: IllusProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Blade */}
      <path d="M14 60 L58 14 Q66 10 68 18 L20 68 Z" strokeWidth="3" {...s(stroke)} />
      {/* Handle */}
      <rect x="14" y="58" width="18" height="12" rx="3" strokeWidth="2.5" {...s(stroke)} />
      {/* Rivets */}
      <circle cx="20" cy="64" r="1.5" fill={stroke} stroke="none" />
      <circle cx="26" cy="64" r="1.5" fill={stroke} stroke="none" />
    </svg>
  );
}

/** Camera / snap icon (brand) */
export function SnapCamera({ stroke = "#2338FF", size = 80, className = "" }: IllusProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <rect x="8" y="24" width="64" height="46" rx="6" strokeWidth="3" {...s(stroke)} />
      <circle cx="40" cy="47" r="14" strokeWidth="3" {...s(stroke)} />
      <circle cx="40" cy="47" r="6" strokeWidth="2.5" {...s(stroke)} />
      <rect x="28" y="14" width="24" height="12" rx="3" strokeWidth="2.5" {...s(stroke)} />
      <circle cx="62" cy="34" r="3" fill={stroke} stroke="none" />
    </svg>
  );
}

/** Decorative cluster for empty states and headers */
export function IllustrationCluster({ stroke = "#2338FF", className = "" }: { stroke?: string; className?: string }) {
  return (
    <div className={`flex items-end gap-4 ${className}`}>
      <NoodleBowl stroke={stroke} size={72} />
      <Tomato stroke={stroke} size={56} />
      <Carrot stroke={stroke} size={64} />
      <Sandwich stroke={stroke} size={60} />
    </div>
  );
}
