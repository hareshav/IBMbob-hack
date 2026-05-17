/**
 * Bobcat mark: two cat-eye slits.
 *
 *   The product looks into your codebase. The mark looks back at you.
 *   Two tapered vertical pupils, drawn with smooth bezier curves so they
 *   stay sharp at 16px and crisp at 256px. Pure monochrome (currentColor)
 *   so it inverts cleanly on any background.
 *
 *   - Confident, geometric, sits next to a Linear / Vercel / Anthropic mark
 *     without looking out of place.
 *   - No tricks, no gradients in the mark itself. The wordmark may use a
 *     gradient tile, but the eyes are always one solid colour.
 */
export default function Logo({ size = 32, color = 'currentColor', title = 'Bobcat' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Left pupil: tapered cat-eye slit */}
      <path
        d="M22 10 C 30 16, 30 48, 22 54 C 14 48, 14 16, 22 10 Z"
        fill={color}
      />
      {/* Right pupil */}
      <path
        d="M42 10 C 50 16, 50 48, 42 54 C 34 48, 34 16, 42 10 Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Wordmark lockup: the mark on a tinted tile + the name.
 * Used in HomePage header and footer. Compact, no subtitle by default
 * (the page itself already establishes the product, and subtitles read
 * as sponsor noise next to a name in a product header).
 */
export function LogoLockup({ size = 36, subtitle = null }) {
  const tile = size + 6;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, position: 'relative' }}>
      <div style={{
        width: tile, height: tile, borderRadius: 10,
        background: 'linear-gradient(135deg, #0F1115 0%, #1A1D29 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(79,142,247,0.18) inset',
        color: '#fff',
      }}>
        <Logo size={Math.round(size * 0.55)} color="#fff" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontSize: 17, fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        }}>
          Bobcat
        </span>
        {subtitle && (
          <span style={{
            fontSize: 9.5, marginTop: 4,
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            fontWeight: 500,
            textTransform: 'uppercase',
          }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
