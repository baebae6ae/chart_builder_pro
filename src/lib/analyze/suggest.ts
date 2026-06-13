import type { ChartConfig, DataTable, SeriesType, VizType } from '@/types';
import { uid } from '@/lib/util/id';
import { profileColumns, type ColumnProfile } from '@/lib/analyze/profile';

/**
 * Auto-suggestion engine. Given any uploaded table, it profiles the columns and
 * proposes a ranked set of ready-to-use visualizations — the "upload anything,
 * pick the good ones" experience. Each suggestion is a full ChartConfig the
 * canvas can render and the user can then tweak or export.
 */
export interface Suggestion {
  id: string;
  title: string;
  /** One-line reason, shown under the preview. */
  reason: string;
  chart: ChartConfig;
}

function chart(partial: Partial<ChartConfig>): ChartConfig {
  return { title: '', viz: 'combo', xColumnId: null, series: [], aggregate: true, ...partial };
}

const measure = (columnId: string, type: SeriesType, agg: 'sum' = 'sum') => ({
  columnId,
  axis: 'yLeft' as const,
  type,
  agg,
});

export function suggestCharts(table: DataTable): Suggestion[] {
  const profiles = profileColumns(table);
  const dims = profiles.filter((p) => p.role === 'dimension').sort((a, b) => a.distinct - b.distinct);
  const dates = profiles.filter((p) => p.role === 'date');
  const measures = profiles.filter((p) => p.role === 'measure');

  const out: Suggestion[] = [];
  const push = (title: string, reason: string, c: ChartConfig) =>
    out.push({ id: uid('sug'), title, reason, chart: c });

  // 1) Frequency distribution (COUNT) for each useful category column.
  for (const d of dims.slice(0, 5)) {
    const viz: VizType = d.distinct <= 6 ? 'pie' : 'combo';
    push(`${d.name} 분포`, `범주별 건수 (${d.distinct}개 항목)`, chart({
      title: `${d.name} 분포`,
      viz,
      xColumnId: d.columnId,
      series: [],
      aggregate: true,
    }));
  }

  // 2) Trend / breakdown of numeric measures by the best dimension.
  const groupBy = dates[0] ?? dims[0];
  if (groupBy && measures.length > 0) {
    for (const m of measures.slice(0, 2)) {
      const isDate = Boolean(dates[0]);
      push(`${groupBy.name}별 ${m.name}`, isDate ? '시간 추세' : '범주별 합계', chart({
        title: `${groupBy.name}별 ${m.name}`,
        viz: 'combo',
        xColumnId: groupBy.columnId,
        series: [measure(m.columnId, isDate ? 'line' : 'bar')],
        aggregate: true,
      }));
    }
  }

  // 3) KPI summary — totals of measures, or the overall record count.
  if (measures.length > 0) {
    push('핵심 지표', '주요 값의 합계', chart({
      title: '핵심 지표',
      viz: 'kpi',
      series: measures.slice(0, 4).map((m) => measure(m.columnId, 'bar')),
      aggregate: false,
    }));
  } else {
    push('총 건수', '전체 레코드 수', chart({
      title: '총 건수',
      viz: 'kpi',
      xColumnId: dims[0]?.columnId ?? null,
      series: [],
      aggregate: true,
    }));
  }

  // 4) The data itself as a clean table (always handy).
  push('데이터 표', '선택 데이터를 표로', chart({
    title: '데이터 표',
    viz: 'table',
    xColumnId: dims[0]?.columnId ?? null,
    series: [],
    aggregate: Boolean(dims[0]) && measures.length === 0,
  }));

  return out.slice(0, 9);
}

export type { ColumnProfile };
