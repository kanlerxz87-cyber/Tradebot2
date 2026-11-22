import { LineChart } from 'lucide-react';
import { formatMoney, formatTime } from '../lib/format';
import type { EquityPoint } from '../types/kalshi';
import { EmptyState } from './EmptyState';

interface EquityChartProps {
  points: EquityPoint[];
}

export function EquityChart({ points }: EquityChartProps) {
  if (points.length === 0) {
    return <EmptyState icon={LineChart} title="No paper equity history" detail="The automated simulator has not recorded an equity point." />;
  }

  const width = 760;
  const height = 220;
  const padding = 28;
  const values = points.map((point) => point.equity);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const margin = Math.max(1, (rawMax - rawMin) * 0.2);
  const min = rawMin - margin;
  const max = rawMax + margin;
  const start = points[0]?.timestamp ?? Date.now();
  const end = points.at(-1)?.timestamp ?? start + 1;
  const mapped = points.map((point, index) => ({
    ...point,
    x: padding + (end === start ? index / Math.max(1, points.length - 1) : (point.timestamp - start) / (end - start)) * (width - padding * 2),
    y: padding + (1 - (point.equity - min) / (max - min)) * (height - padding * 2),
  }));
  const path = mapped.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');

  return (
    <div className="equity-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Automated paper portfolio equity over time">
        <defs>
          <linearGradient id="equityArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7bc8f6" stopOpacity=".28" />
            <stop offset="1" stopColor="#7bc8f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = padding + ratio * (height - padding * 2);
          return (
            <g key={ratio}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid-line" />
              <text x={padding} y={y - 5} className="chart-axis-label">{formatMoney(max - ratio * (max - min), 0)}</text>
            </g>
          );
        })}
        {mapped.length > 1 && <path d={`${path} L ${mapped.at(-1)?.x} ${height - padding} L ${mapped[0]?.x} ${height - padding} Z`} fill="url(#equityArea)" />}
        <path d={path} className="equity-line" />
        {mapped.map((point, index) => <circle key={`${point.timestamp}-${index}`} cx={point.x} cy={point.y} r={index === mapped.length - 1 ? 4 : 2} />)}
        <text x={padding} y={height - 5} className="chart-axis-label">{formatTime(start)}</text>
        <text x={width - padding} y={height - 5} textAnchor="end" className="chart-axis-label">{formatTime(end)}</text>
      </svg>
    </div>
  );
}
