import { useId } from 'react';

import { BRAND_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  title?: string;
}

/*
 * Curio mark: an ammonite — the classic cabinet-of-curiosities fossil — whose
 * tapering whorl opens to the right as a "C". Chamber walls (septa) are cut
 * into the shell. Geometry is a logarithmic spiral band; the static icons in
 * /public use the same paths.
 */
const SHELL_PATH = 'M50.8 43.8L51.8 41.3L52.4 38.8L52.7 36.3L52.6 33.8L52.3 31.3L51.7 29L50.8 26.7L49.7 24.7L48.4 22.8L46.8 21.1L45.1 19.7L43.3 18.5L41.4 17.5L39.4 16.8L37.3 16.4L35.3 16.2L33.3 16.3L31.3 16.6L29.4 17.1L27.7 17.9L26.1 18.8L24.6 20L23.3 21.2L22.2 22.6L21.2 24.1L20.5 25.7L20 27.3L19.7 28.9L19.6 30.6L19.7 32.2L20 33.8L20.4 35.2L21.1 36.6L21.9 37.9L22.8 39.1L23.8 40.1L25 41L26.2 41.7L27.5 42.2L28.8 42.6L30.1 42.8L31.4 42.9L32.7 42.8L33.9 42.5L35.1 42.1L36.2 41.6L37.3 40.9L38.2 40.1L39 39.3L39.6 38.3L40.2 37.4L40.6 36.3L40.9 35.3L41 34.2L41 33.1L40.9 32.1L40.7 31.1L40.3 30.2L39.9 29.3L39.3 28.5L38.7 27.8L38 27.2L37.2 26.6L36.4 26.2L35.6 25.9L34.7 25.7L33.9 25.6L33 25.6L32.2 25.7L31.4 25.9L30.7 26.3L30 26.6L29.3 27.1L28.8 27.6L28.3 28.2L27.9 28.8L27.6 29.5L27.3 30.1L27.2 30.8L27.1 31.5L27.2 32.2L27.3 32.9L27.5 33.5L27.7 34.1L28 34.6L28.4 35.1L28.8 35.6L29.3 35.9L29.8 36.3L30.4 36.5L30.9 36.7L31.5 36.8L32 36.8L32.6 36.8L33.1 36.7L33.6 36.5L34.1 36.3L34.5 36L34.9 35.7L35.2 35.3L35.5 35L35.8 34.5L35.9 34.1L36.1 33.7L36.1 33.2L36.1 32.8L36.1 32.3L36 31.9L35.9 31.5L35.7 31.2L35.2 31.3L34.7 31.5L34.9 31.8L35 32.1L35 32.4L35 32.7L35 33L35 33.3L34.9 33.6L34.8 33.9L34.6 34.2L34.4 34.4L34.2 34.7L33.9 34.9L33.6 35.1L33.3 35.2L32.9 35.3L32.6 35.4L32.2 35.4L31.8 35.4L31.4 35.3L31 35.2L30.7 35.1L30.3 34.8L30 34.6L29.7 34.3L29.4 33.9L29.2 33.6L29 33.2L28.9 32.7L28.8 32.3L28.8 31.8L28.9 31.3L29 30.8L29.1 30.4L29.3 29.9L29.6 29.5L30 29.1L30.3 28.7L30.8 28.4L31.3 28.2L31.8 27.9L32.3 27.8L32.9 27.7L33.5 27.7L34.1 27.8L34.7 27.9L35.2 28.1L35.8 28.4L36.3 28.8L36.8 29.2L37.2 29.7L37.6 30.3L37.9 30.9L38.2 31.5L38.3 32.2L38.4 32.9L38.4 33.6L38.3 34.4L38.1 35.1L37.8 35.8L37.5 36.5L37 37.1L36.4 37.7L35.8 38.3L35.1 38.7L34.3 39.1L33.5 39.4L32.7 39.6L31.8 39.6L30.9 39.6L30 39.5L29.1 39.2L28.2 38.8L27.3 38.3L26.5 37.7L25.8 37L25.2 36.2L24.6 35.3L24.2 34.4L23.9 33.3L23.7 32.3L23.6 31.1L23.7 30L23.9 28.9L24.3 27.8L24.8 26.7L25.4 25.6L26.2 24.7L27.1 23.8L28.1 23L29.2 22.4L30.4 21.9L31.7 21.5L33.1 21.3L34.5 21.2L35.9 21.4L37.3 21.7L38.6 22.1L40 22.8L41.2 23.6L42.4 24.6L43.5 25.8L44.4 27.1L45.2 28.5L45.8 30L46.2 31.6L46.4 33.3L46.4 35.1L46.2 36.8L45.8 38.6L45.2 40.3Z';

const SEPTA: { d: string; width: number }[] = [
  { d: 'M50.8 25Q45.9 24.3 44.2 27.7', width: 1.7 },
  { d: 'M27.8 17.1Q26.9 21 29.6 22.7', width: 1.4 },
  { d: 'M19.9 35.2Q23 36.2 24.5 34.2', width: 1.1 },
  { d: 'M34 42.9Q35 40.5 33.5 39.1', width: 0.9 },
  { d: 'M41.2 32Q39.3 31 38.1 32.1', width: 0.9 },
  { d: 'M32.9 25.4Q31.9 26.9 32.8 27.9', width: 0.9 },
];

export function BrandMark({ className, title = `${BRAND_NAME} logo` }: BrandMarkProps) {
  const id = useId();
  const bgId = `${id}-bg`;
  const sheenId = `${id}-sheen`;
  const septaId = `${id}-septa`;

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={bgId} x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={sheenId} x1="32" y1="0" x2="32" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={septaId}>
          <rect width="64" height="64" fill="#fff" />
          {SEPTA.map((septum) => (
            <path
              key={septum.d}
              d={septum.d}
              fill="none"
              stroke="#000"
              strokeWidth={septum.width}
              strokeLinecap="round"
            />
          ))}
        </mask>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${bgId})`} />
      <rect width="64" height="64" rx="15" fill={`url(#${sheenId})`} />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="14.25"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <path d={SHELL_PATH} fill="#fff" mask={`url(#${septaId})`} />
    </svg>
  );
}
