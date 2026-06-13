import type { ChartConfig, DataTable, Theme } from '@/types';
import { vizMeta, isVizApplicable } from '@/lib/chart/registry';
import { buildReportTable } from '@/lib/chart/tableModel';
import { buildKpis } from '@/lib/chart/kpiModel';
import ChartView from './ChartView';
import TableView from './TableView';
import KpiView from './KpiView';

/**
 * Single switchboard that turns a (table, chart, theme) triple into the right
 * visualization. Both the live canvas and the snapshot compare board render
 * through here, so there is exactly one place that maps a viz type to a view —
 * no duplicated rendering logic.
 */
export default function VizRenderer({
  table,
  chart,
  theme,
}: {
  table: DataTable;
  chart: ChartConfig;
  theme: Theme;
}) {
  if (!isVizApplicable(chart.viz, chart)) {
    const meta = vizMeta(chart.viz);
    return (
      <div className="empty">
        <strong>{meta.icon} {meta.label}</strong>
        <span>{meta.hint}</span>
      </div>
    );
  }

  const meta = vizMeta(chart.viz);
  if (meta.render === 'table') return <TableView model={buildReportTable(table, chart)} />;
  if (meta.render === 'kpi') return <KpiView cards={buildKpis(table, chart)} colors={theme.colors} />;
  return <ChartView table={table} chart={chart} theme={theme} />;
}
