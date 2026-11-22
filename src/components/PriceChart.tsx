import { Activity, Clock3, LineChart as LineChartIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { marketDayChange, marketPrice } from '../lib/analytics';
import { formatDateTime, formatPrice, formatSignedPrice, formatTime } from '../lib/format';
import { marketSourceUrl } from '../services/kalshi';
import type { DashboardMarket, PricePoint } from '../types/kalshi';
import { EmptyState } from './EmptyState';
import { SourceLink } from './SourceLink';

const WIDTH = 820;
const HEIGHT = 300;
const PAD = { top: 24, right: 22, bottom: 38, left: 48 };
const ranges = [
  { id: '60s', label: '60 sec', milliseconds: 60_000 },
  { id: '15m', label: '15 min', milliseconds: 15 * 60_000 },
  { id: '1h', label: '1 hour', milliseconds: 60 * 60_000 },
] as const;

type RangeId = (typeof ranges)[number]['id'];

interface PriceChartProps {
  market: DashboardMarket | null;
  points: PricePoint[];
}

export function PriceChart({ market, points }: PriceChartProps) {
  const [rangeId, setRangeId] = useState<RangeId>('15m');
  const [hovered, setHovered] = useState<number | null>(null);
  const range = ranges.find((item) => item.id === rangeId) ?? ranges[1];

  const chart = useMemo(() => {
    const now = Date.now();
    const filtered = points.filter((point) => point.timestamp >= now - range.milliseconds);
    if (filtered.length === 0) return null;

    const prices = filtered.map((point) => point.price);
    let min = Math.max(0, Math.min(...prices) - 0.04);
    let max = Math.min(1, Math.max(...prices) + 0.04);
    if (max - min < 0.1) {
      const midpoint = (max + min) / 2;
      min = Math.max(0, midpoint - 0.05);
      max = Math.min(1, midpoint + 0.05);
    }

    const start = now - range.milliseconds;
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const mapped = filtered.map((point) => ({
      ...point,
      x: PAD.left + ((point.timestamp - start) / range.milliseconds) * plotWidth,
      y: PAD.top + (1 - (point.price - min) / Math.max(0.001, max - min)) * plotHeight,
    }));

    return {
      points: mapped,
      min,
      max,
      start,
      end: now,
      path: mapped.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),
    };
  }, [points, range.milliseconds]);

  const dayChange = market ? marketDayChange(market) : null;
  const current = market ? marketPrice(market) : null;
  const hoveredPoint = chart && hovered !== null ? chart.points[hovered] : null;

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!chart || chart.points.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    chart.points.forEach((point, index) => {
      const distance = Math.abs(point.x - svgX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setHovered(nearestIndex);
  }

  return (
    <section className="chart-card">
      <header className="panel-header chart-card__header">
        <div>
          <span className="panel-kicker">PRICE MONITOR</span>
          <h2>{market ? market.eventTitle : 'Select a live contract'}</h2>
          <p>{market ? market.yes_sub_title || market.title || market.ticker : 'Choose an event row to inspect its verified YES price.'}</p>
        </div>
        <div className="chart-header__right">
          {market && (
            <div className="chart-current">
              <small>YES now</small>
              <strong>{formatPrice(current)}</strong>
              <span className={dayChange === null ? 'muted' : dayChange >= 0 ? 'positive' : 'negative'}>{formatSignedPrice(dayChange)} 24h</span>
            </div>
          )}
          <div className="segmented-control" aria-label="Chart time range">
            {ranges.map((item) => (
              <button key={item.id} type="button" className={rangeId === item.id ? 'active' : ''} onClick={() => setRangeId(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="chart-body">
        {!market ? (
          <EmptyState icon={LineChartIcon} title="No contract selected" detail="Select a sourced event in the market table below." />
        ) : !chart ? (
          <EmptyState icon={Clock3} title={`No ${range.label} history yet`} detail="The chart records verified prices while this page is open; no historical values are fabricated." />
        ) : (
          <div className="chart-canvas">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={`YES price chart for ${market.eventTitle}`}
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHovered(null)}
            >
              <defs>
                <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a8f04f" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#a8f04f" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = PAD.top + ratio * (HEIGHT - PAD.top - PAD.bottom);
                const value = chart.max - ratio * (chart.max - chart.min);
                return (
                  <g key={ratio}>
                    <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="chart-grid-line" />
                    <text x={PAD.left - 10} y={y + 4} textAnchor="end" className="chart-axis-label">{Math.round(value * 100)}¢</text>
                  </g>
                );
              })}
              {[0, 0.5, 1].map((ratio) => {
                const x = PAD.left + ratio * (WIDTH - PAD.left - PAD.right);
                const time = chart.start + ratio * (chart.end - chart.start);
                return <text key={ratio} x={x} y={HEIGHT - 10} textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'} className="chart-axis-label">{formatTime(time)}</text>;
              })}
              {chart.points.length > 1 && (
                <>
                  <path d={`${chart.path} L ${chart.points.at(-1)?.x} ${HEIGHT - PAD.bottom} L ${chart.points[0]?.x} ${HEIGHT - PAD.bottom} Z`} fill="url(#chartArea)" />
                  <path d={chart.path} className="chart-line" />
                </>
              )}
              {chart.points.map((point, index) => (
                <circle key={`${point.timestamp}-${index}`} cx={point.x} cy={point.y} r={index === chart.points.length - 1 ? 4 : 2.4} className="chart-dot" />
              ))}
              {hoveredPoint && (
                <g className="chart-hover">
                  <line x1={hoveredPoint.x} x2={hoveredPoint.x} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
                  <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" />
                  <g transform={`translate(${Math.min(WIDTH - 155, Math.max(PAD.left, hoveredPoint.x - 65))}, ${Math.max(12, hoveredPoint.y - 58)})`}>
                    <rect width="130" height="44" rx="8" />
                    <text x="10" y="18">{formatPrice(hoveredPoint.price)}</text>
                    <text x="10" y="34">{formatTime(hoveredPoint.timestamp)}</text>
                  </g>
                </g>
              )}
            </svg>
          </div>
        )}
      </div>

      <footer className="chart-footer">
        <span><Activity size={13} /> X: timestamp · Y: official last YES price</span>
        {market ? (
          <>
            <span>Observed {formatDateTime(market.lastSeenAt)}</span>
            <SourceLink href={marketSourceUrl(market.ticker)} label="Market API" />
          </>
        ) : <span>Source appears after selection</span>}
      </footer>
    </section>
  );
}
