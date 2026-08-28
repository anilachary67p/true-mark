export function MiniLineChart({ points }: { points?: number[] }) {
  const data = points && points.length > 1 ? points : [12, 18, 14, 22, 19, 28, 24, 32, 27, 35, 30, 38];
  const width = 400;
  const height = 120;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;

  const coords = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 20) - 10;
    return { x, y };
  });

  const linePath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="hopeArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a57e8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3a57e8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#hopeArea)" />
      <path d={linePath} fill="none" stroke="#3a57e8" strokeWidth="2.5" strokeLinecap="round" />
      {coords.map((p, i) =>
        i % Math.max(1, Math.floor(coords.length / 6)) === 0 || i === coords.length - 1 ? (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3a57e8" stroke="white" strokeWidth="2" />
        ) : null,
      )}
    </svg>
  );
}
