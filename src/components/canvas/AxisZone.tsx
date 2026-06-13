import { useDroppable } from '@dnd-kit/core';
import type { AxisKey, ChartConfig, DataTable, MeasureAgg, SeriesType } from '@/types';
import { useDocumentStore } from '@/store/documentStore';
import { AGG_LABEL, MEASURE_AGGS } from '@/lib/chart/kpiModel';

interface AxisZoneProps {
  axis: AxisKey;
  label: string;
  table: DataTable;
  chart: ChartConfig;
}

const columnName = (table: DataTable, id: string) =>
  table.columns.find((c) => c.id === id)?.name ?? id;

/**
 * One axis drop target (분류 / 값 좌 / 값 우). Bound columns render as removable
 * chips; value chips expose an aggregation (합계/평균/건수…) and, in combo mode,
 * a bar/line/area toggle. When a dimension is set with no values, a hint notes
 * that rows are counted automatically.
 */
export default function AxisZone({ axis, label, table, chart }: AxisZoneProps) {
  const removeSeries = useDocumentStore((s) => s.removeSeries);
  const setSeriesType = useDocumentStore((s) => s.setSeriesType);
  const setMeasureAgg = useDocumentStore((s) => s.setMeasureAgg);

  const { isOver, setNodeRef } = useDroppable({ id: axis, data: { axis } });

  const isX = axis === 'x';
  const valueChips = chart.series.filter((s) => s.axis === axis);
  const showCountHint =
    axis === 'yLeft' && chart.aggregate && chart.xColumnId !== null && chart.series.length === 0;

  return (
    <div ref={setNodeRef} className={`dropzone${isOver ? ' dropzone--over' : ''}`}>
      <span className="dropzone__label">{label}</span>

      {isX && chart.xColumnId && (
        <span className="chip">
          {columnName(table, chart.xColumnId)}
          <button className="chip__x" title="제거" onClick={() => removeSeries(chart.xColumnId!)}>
            ×
          </button>
        </span>
      )}

      {!isX &&
        valueChips.map((s) => (
          <span key={s.columnId ?? 'count'} className="chip">
            {s.columnId ? columnName(table, s.columnId) : '건수'}
            {s.columnId && (
              <select
                value={s.agg}
                title="집계 방식"
                onChange={(e) => setMeasureAgg(s.columnId!, e.target.value as MeasureAgg)}
              >
                {MEASURE_AGGS.filter((a) => a !== 'count').map((a) => (
                  <option key={a} value={a}>
                    {AGG_LABEL[a]}
                  </option>
                ))}
              </select>
            )}
            {chart.viz === 'combo' && (
              <select
                value={s.type}
                title="표현"
                onChange={(e) => setSeriesType(s.columnId!, e.target.value as SeriesType)}
              >
                <option value="bar">막대</option>
                <option value="line">꺾은선</option>
                <option value="area">영역</option>
              </select>
            )}
            <button className="chip__x" title="제거" onClick={() => removeSeries(s.columnId!)}>
              ×
            </button>
          </span>
        ))}

      {isX && !chart.xColumnId && <span className="hint">여기에 블록을 놓기</span>}
      {showCountHint && <span className="hint">비어 있으면 행 개수(건수)로 집계됩니다</span>}
      {!isX && !showCountHint && valueChips.length === 0 && (
        <span className="hint">여기에 블록을 놓기</span>
      )}
    </div>
  );
}
