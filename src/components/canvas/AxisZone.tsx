import { useDroppable } from '@dnd-kit/core';
import type { AxisKey, ChartConfig, DataTable, SeriesType } from '@/types';
import { useDocumentStore } from '@/store/documentStore';

interface AxisZoneProps {
  axis: AxisKey;
  label: string;
  table: DataTable;
  chart: ChartConfig;
}

const columnName = (table: DataTable, id: string) =>
  table.columns.find((c) => c.id === id)?.name ?? id;

/**
 * One axis drop target (X, Y-left, Y-right). Renders the columns currently
 * bound to it as removable chips; Y chips also expose a bar/line toggle so a
 * mixed chart is one click away.
 */
export default function AxisZone({ axis, label, table, chart }: AxisZoneProps) {
  const removeSeries = useDocumentStore((s) => s.removeSeries);
  const setSeriesType = useDocumentStore((s) => s.setSeriesType);

  const { isOver, setNodeRef } = useDroppable({ id: axis, data: { axis } });

  const assigned =
    axis === 'x'
      ? chart.xColumnId
        ? [{ columnId: chart.xColumnId, type: null as SeriesType | null }]
        : []
      : chart.series
          .filter((s) => s.axis === axis)
          .map((s) => ({ columnId: s.columnId, type: s.type }));

  return (
    <div ref={setNodeRef} className={`dropzone${isOver ? ' dropzone--over' : ''}`}>
      <span className="dropzone__label">{label}</span>
      {assigned.length === 0 && <span className="hint">여기에 블록을 놓기</span>}
      {assigned.map(({ columnId, type }) => (
        <span key={columnId} className="chip">
          {columnName(table, columnId)}
          {type && chart.viz === 'combo' && (
            <select
              value={type}
              onChange={(e) => setSeriesType(columnId, e.target.value as SeriesType)}
            >
              <option value="bar">막대</option>
              <option value="line">꺾은선</option>
              <option value="area">영역</option>
            </select>
          )}
          <button
            className="chip__x"
            title="제거"
            onClick={() => removeSeries(columnId)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
