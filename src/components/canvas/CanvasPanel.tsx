import { useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useThemeStore } from '@/store/themeStore';
import { exportToPptx } from '@/lib/export/pptx';
import { vizMeta, isVizApplicable } from '@/lib/chart/registry';
import { AGGREGATIONS, AGG_LABEL } from '@/lib/chart/kpiModel';
import type { Aggregation } from '@/types';
import VizRenderer from '@/components/common/VizRenderer';
import AxisZone from './AxisZone';
import VizPicker from './VizPicker';

/**
 * Center panel: axis drop zones, the visualization gallery, the live output,
 * and PPTX export. Editing data, dragging a block, or picking a viz type all
 * flow through the document store, which re-renders the output in real time.
 */
export default function CanvasPanel() {
  const table = useDocumentStore((s) => s.table);
  const chart = useDocumentStore((s) => s.chart);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const setAgg = useDocumentStore((s) => s.setAgg);
  const theme = useThemeStore((s) => s.theme);

  const [exporting, setExporting] = useState(false);

  const ready = Boolean(table && isVizApplicable(chart.viz, chart));

  const handleExport = async () => {
    if (!table) return;
    setExporting(true);
    try {
      await exportToPptx(table, chart, theme, `${chart.title || 'chart-builder-pro'}.pptx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="panel panel--canvas">
      <div className="axes">
        {table ? (
          <>
            <AxisZone axis="x" label="분류 (X / 항목)" table={table} chart={chart} />
            <AxisZone axis="yLeft" label="값 (Y축 좌)" table={table} chart={chart} />
            <AxisZone axis="yRight" label="값 (Y축 우)" table={table} chart={chart} />
          </>
        ) : (
          <div className="dropzone" style={{ gridColumn: '1 / -1' }}>
            <span className="hint">데이터를 업로드하면 분류·값 영역이 활성화됩니다.</span>
          </div>
        )}
      </div>

      {table && <VizPicker />}

      <div className="card chart-card">
        <div className="chart-card__head">
          <input
            className="chart-card__title-input"
            placeholder="제목을 입력하세요"
            value={chart.title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {chart.viz === 'kpi' && (
            <select
              aria-label="집계 방식"
              value={chart.agg}
              onChange={(e) => setAgg(e.target.value as Aggregation)}
            >
              {AGGREGATIONS.map((a) => (
                <option key={a} value={a}>
                  {AGG_LABEL[a]}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn--primary"
            onClick={handleExport}
            disabled={!ready || exporting}
            title={ready ? 'PPT로 내보내기' : '먼저 데이터를 배치하세요'}
          >
            {exporting ? '생성 중…' : 'PPT 다운로드'}
          </button>
        </div>

        {table ? (
          <VizRenderer table={table} chart={chart} theme={theme} />
        ) : (
          <div className="empty">
            <strong>{vizMeta(chart.viz).icon} 미리보기</strong>
            <span>좌측 컬럼 블록을 분류·값 영역으로 끌어다 놓으면 시각화가 즉시 생성됩니다.</span>
          </div>
        )}
      </div>
    </section>
  );
}
