'use client';

import { useId } from 'react';
import { cn } from './cn';

const DECORATIVE_POINTS = [12, 18, 15, 24, 20, 28, 22, 30, 26, 34, 29, 36];

function buildLinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return '';
  return coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

function buildCoords(
  series: number[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
  min: number,
  span: number,
) {
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  return series.map((value, index) => {
    const x =
      series.length === 1
        ? padding.left + innerW / 2
        : padding.left + (index / (series.length - 1)) * innerW;
    const y = padding.top + innerH - ((value - min) / span) * innerH;
    return { x, y };
  });
}

export function MiniLineChart({
  points,
  points2,
  stroke = '#3a57e8',
  stroke2 = '#94a3b8',
  compact = false,
  className,
}: {
  points?: number[];
  points2?: number[];
  stroke?: string;
  stroke2?: string;
  compact?: boolean;
  className?: string;
}) {
  const gradientId = useId();
  const data = points && points.length > 0 ? points : DECORATIVE_POINTS;
  const data2 = points2 && points2.length > 0 ? points2 : undefined;
  const combined = data2 ? [...data, ...data2] : data;

  const width = 400;
  const height = compact ? 56 : 140;
  const padding = compact
    ? { top: 6, right: 4, bottom: 6, left: 4 }
    : { top: 12, right: 8, bottom: 16, left: 8 };

  const max = Math.max(...combined, 1);
  const min = Math.min(...combined, 0);
  const span = max - min || 1;
  const gridLines = compact ? 2 : 4;

  const primaryCoords = buildCoords(data, width, height, padding, min, span);
  const primaryLine = buildLinePath(primaryCoords);
  const primaryArea = primaryLine
    ? `${primaryLine} L${width - padding.right},${height - padding.bottom} L${padding.left},${height - padding.bottom} Z`
    : '';

  const secondaryCoords = data2
    ? buildCoords(data2, width, height, padding, min, span)
    : null;
  const secondaryLine = secondaryCoords ? buildLinePath(secondaryCoords) : null;

  const allZero = combined.every((value) => value === 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-full w-full', className)}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={compact ? '0.2' : '0.28'} />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: gridLines }, (_, i) => {
        const y = padding.top + ((i + 1) / (gridLines + 1)) * (height - padding.top - padding.bottom);
        return (
          <line
            key={y}
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        );
      })}

      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="#cbd5e1"
        strokeWidth="1"
      />

      {allZero && points && points.length > 0 ? (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          className="fill-slate-400 text-[11px]"
        >
          No activity in this period
        </text>
      ) : (
        <>
          {primaryArea && <path d={primaryArea} fill={`url(#${gradientId})`} />}
          {secondaryLine && (
            <path
              d={secondaryLine}
              fill="none"
              stroke={stroke2}
              strokeWidth={compact ? 1.5 : 2}
              strokeDasharray="6 4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {primaryLine && (
            <path
              d={primaryLine}
              fill="none"
              stroke={stroke}
              strokeWidth={compact ? 2 : 2.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {!compact &&
            primaryCoords.map((coord, i) => (
              <circle
                key={i}
                cx={coord.x}
                cy={coord.y}
                r="3"
                fill="#fff"
                stroke={stroke}
                strokeWidth="2"
              />
            ))}
        </>
      )}
    </svg>
  );
}
