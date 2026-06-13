import { useDocumentStore } from '@/store/documentStore';
import { VIZ_TYPES, isVizApplicable } from '@/lib/chart/registry';

/**
 * Gallery of visualization types. Each entry is enabled only when the current
 * dimension/measure binding can produce it, guiding the user toward valid
 * outputs. Selecting one updates the document store; the canvas re-renders.
 */
export default function VizPicker() {
  const chart = useDocumentStore((s) => s.chart);
  const setViz = useDocumentStore((s) => s.setViz);

  return (
    <div className="viz-picker" role="tablist" aria-label="시각화 종류">
      {VIZ_TYPES.map((v) => {
        const applicable = isVizApplicable(v.id, chart);
        const active = chart.viz === v.id;
        return (
          <button
            key={v.id}
            role="tab"
            aria-selected={active}
            className={`viz-chip${active ? ' viz-chip--active' : ''}`}
            disabled={!applicable}
            title={applicable ? v.hint : `${v.hint} — 조건이 더 필요합니다`}
            onClick={() => setViz(v.id)}
          >
            <span className="viz-chip__icon" aria-hidden>{v.icon}</span>
            <span className="viz-chip__label">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
