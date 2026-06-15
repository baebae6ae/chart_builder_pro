import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useThemeStore } from '@/store/themeStore';
import { exportToPptx } from '@/lib/export/pptx';
import { vizMeta, isVizApplicable } from '@/lib/chart/registry';
import type { DataTable } from '@/types';
import VizRenderer from '@/components/common/VizRenderer';
import AxisZone from './AxisZone';
import VizPicker from './VizPicker';
import InsightGallery from './InsightGallery';

type Mode = 'suggest' | 'edit';

/**
 * Center panel. Two modes: an auto-suggestion gallery (default after an upload)
 * and a manual editor (axis drop zones + visualization gallery + live output).
 * Everything flows through the document store, which re-renders in real time.
 */
export default function CanvasPanel() {
  const table = useDocumentStore((s) => s.table);
  const chart = useDocumentStore((s) => s.chart);
  const insights = useDocumentStore((s) => s.insights);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const setAggregate = useDocumentStore((s) => s.setAggregate);
  const theme = useThemeStore((s) => s.theme);

  const [mode, setMode] = useState<Mode>('edit');
  const [exporting, setExporting] = useState(false);

  // Reset to the insight gallery whenever a new dataset is loaded.
  const lastTable = useRef<DataTable | null>(null);
  useEffect(() => {
    if (table && table !== lastTable.current) {
      lastTable.current = table;
      setMode(insights.length > 0 ? 'suggest' : 'edit');
    }
  }, [table, insights]);

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

  if (!table) {
    return (
      <section className="panel panel--canvas">
        <div className="card chart-card">
          <div className="empty">
            <strong>데이터로 시작하기</strong>
            <span>좌측에서 엑셀·CSV 파일을 업로드하면 추천 시각화가 자동으로 만들어집니다.</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel panel--canvas">
      <div className="canvas-tabs">
        <button
          className={`editor-tab${mode === 'suggest' ? ' editor-tab--active' : ''}`}
          onClick={() => setMode('suggest')}
        >
          추천 시각화{insights.length > 0 ? ` (${insights.length})` : ''}
        </button>
        <button
          className={`editor-tab${mode === 'edit' ? ' editor-tab--active' : ''}`}
          onClick={() => setMode('edit')}
        >
          직접 편집
        </button>
      </div>

      {mode === 'suggest' ? (
        <InsightGallery onOpen={() => setMode('edit')} />
      ) : (
        <>
          <div className="axes">
            <AxisZone axis="x" label="분류 (X / 항목)" table={table} chart={chart} />
            <AxisZone axis="yLeft" label="값 (Y축 좌)" table={table} chart={chart} />
            <AxisZone axis="yRight" label="값 (Y축 우)" table={table} chart={chart} />
          </div>

          <div className="canvas-controls">
            <VizPicker />
            <label className="agg-toggle" title="분류별로 묶어서 집계합니다">
              <input
                type="checkbox"
                checked={chart.aggregate}
                onChange={(e) => setAggregate(e.target.checked)}
              />
              분류별 집계
            </label>
          </div>

          <div className="card chart-card">
            <div className="chart-card__head">
              <input
                className="chart-card__title-input"
                placeholder="제목을 입력하세요"
                value={chart.title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <button
                className="btn--primary"
                onClick={handleExport}
                disabled={!ready || exporting}
                title={ready ? 'PPT로 내보내기' : '먼저 데이터를 배치하세요'}
              >
                {exporting ? '생성 중…' : 'PPT 다운로드'}
              </button>
            </div>

            {ready ? (
              <VizRenderer table={table} chart={chart} theme={theme} />
            ) : (
              <div className="empty">
                <strong>{vizMeta(chart.viz).icon} 미리보기</strong>
                <span>
                  좌측 컬럼 블록을 <b>분류</b>에 놓으면 건수 차트가, <b>값</b>에 놓으면 합계
                  차트가 즉시 그려집니다.
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
