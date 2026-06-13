import type { KpiCard } from '@/lib/chart/kpiModel';
import { formatCompact } from '@/lib/util/format';

/**
 * Presentational KPI / infographic cards. Receives computed {@link KpiCard}s
 * and renders one accent-coloured card per measure. The aggregation choice is
 * driven from the toolbar, not here, so this stays reusable in the compare view.
 */
export default function KpiView({ cards, colors }: { cards: KpiCard[]; colors: string[] }) {
  if (cards.length === 0) {
    return <div className="empty"><span>값 열을 추가하면 핵심지표 카드가 표시됩니다.</span></div>;
  }

  return (
    <div className="kpi-grid">
      {cards.map((card, i) => {
        const accent = colors[i % colors.length] ?? '#2563eb';
        return (
          <div key={card.label} className="kpi-card" style={{ borderTopColor: accent }}>
            <div className="kpi-card__label">{card.label}</div>
            <div className="kpi-card__value" style={{ color: accent }}>
              {formatCompact(card.value)}
            </div>
            <div className="kpi-card__agg">{card.aggLabel}</div>
          </div>
        );
      })}
    </div>
  );
}
