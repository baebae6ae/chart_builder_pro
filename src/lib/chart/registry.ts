import type { ChartConfig, VizType } from '@/types';
import { measureCount } from '@/lib/chart/plotData';

/**
 * Visualization registry — the single catalogue of every output type the app
 * can produce. Adding a new visualization is meant to be "add an entry here +
 * handle it in the matching builder", never a scattered change.
 *
 *   render: which engine draws it
 *     'echarts' -> lib/chart/buildOption.ts produces an ECharts option
 *     'table'   -> lib/chart/tableModel.ts  -> components/common/TableView
 *     'kpi'     -> lib/chart/kpiModel.ts     -> components/common/KpiView
 */
export interface VizMeta {
  id: VizType;
  label: string;
  icon: string;
  render: 'echarts' | 'table' | 'kpi';
  /** Minimum number of measure (value) columns the type needs. */
  minMeasures: number;
  /** Whether a dimension (category) column is required. */
  needsDimension: boolean;
  hint: string;
}

export const VIZ_TYPES: VizMeta[] = [
  { id: 'combo', label: '막대·꺾은선', icon: '📊', render: 'echarts', minMeasures: 1, needsDimension: false, hint: '값 열마다 막대·꺾은선·영역을 자유롭게 섞는 기본 차트' },
  { id: 'stackedBar', label: '누적 막대', icon: '🧱', render: 'echarts', minMeasures: 1, needsDimension: false, hint: '여러 값을 쌓아 전체 대비 구성비를 표현' },
  { id: 'pie', label: '원형', icon: '🥧', render: 'echarts', minMeasures: 1, needsDimension: true, hint: '분류별 비중을 원형으로 (첫 번째 값 열)' },
  { id: 'donut', label: '도넛', icon: '🍩', render: 'echarts', minMeasures: 1, needsDimension: true, hint: '가운데가 빈 원형으로 비중 표현' },
  { id: 'scatter', label: '분포(산점도)', icon: '🟢', render: 'echarts', minMeasures: 2, needsDimension: false, hint: '두 값 열의 상관관계 (X=첫 값, Y=나머지)' },
  { id: 'radar', label: '방사형', icon: '🕸️', render: 'echarts', minMeasures: 1, needsDimension: true, hint: '분류축을 따라 여러 값을 한눈에 비교' },
  { id: 'table', label: '표', icon: '🧾', render: 'table', minMeasures: 0, needsDimension: false, hint: '선택한 열을 정돈된 표로 (미선택 시 전체)' },
  { id: 'kpi', label: '핵심지표 카드', icon: '🔢', render: 'kpi', minMeasures: 1, needsDimension: false, hint: '값 열을 합계·평균 등으로 요약한 인포그래픽 카드' },
];

export const vizMeta = (id: VizType): VizMeta =>
  VIZ_TYPES.find((v) => v.id === id) ?? VIZ_TYPES[0];

/** Whether the current dimension/measure binding satisfies a viz type. */
export function isVizApplicable(id: VizType, chart: ChartConfig): boolean {
  const meta = vizMeta(id);
  // Count synthesized COUNT measures too, so one categorical column is enough.
  if (measureCount(chart) < meta.minMeasures) return false;
  if (meta.needsDimension && !chart.xColumnId) return false;
  return true;
}
