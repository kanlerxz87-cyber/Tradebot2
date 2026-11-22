import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: 'lime' | 'blue' | 'violet' | 'amber';
}

export function MetricCard({ icon: Icon, label, value, detail, tone = 'lime' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span>{label}</span>
        <div className="metric-card__icon"><Icon aria-hidden="true" size={16} /></div>
      </div>
      <div className="metric-card__value">{value}</div>
      <div className="metric-card__detail">{detail}</div>
    </article>
  );
}
