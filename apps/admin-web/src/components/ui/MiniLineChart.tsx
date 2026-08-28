export function MiniLineChart({
  points,
  points2,
  stroke = '#3a57e8',
  stroke2 = '#94a3b8',
}: {
  points?: number[];
  points2?: number[];
  stroke?: string;
  stroke2?: string;
}) {
  const data = points && points.length > 0 ? points : [0];
  const data2 = points2 && points2.length > 0 ? points2 : undefined;
  const combined = data2 ? [...data, ...data2] : data;
  const width = 400;
  const height = 120;
  const max = Math.max(...combined, 1);
  const min = Math.min(...combined, 0);
  const span = max - min || 1;

  function buildPath(series: number[]) {
    if (series.length === 1) {
      const y = height - ((series[0] - min) / span) * (height - 20) - 10;
      return { line: `M0,${y} L${width},${y}`, area: `M0,${y} L${width},${y} L${width},${height} L0,${height} Z` };
    }
    const coords = series.map((value, index) => {
      const x = (index / (series.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 20) - 10;
      return { x, y };
    });
    const linePath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
    return { line: linePath, area: areaPath, coords };
  }

  const primary = buildPath(data);
  const secondary = data2 ? buildPath(data2) : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="hopeAreaPrimary" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={primary.area} fill="url(#hopeAreaPrimary)" />
      <path d={primary.line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      {secondary && (
        <path
          d={secondary.line}
          fill="none"
          stroke={stroke2}
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
