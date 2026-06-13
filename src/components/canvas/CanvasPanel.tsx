import { useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useThemeStore } from '@/store/themeStore';
import { exportToPptx } from '@/lib/export/pptx';
import ChartView from '@/components/common/ChartView';
import AxisZone from './AxisZone';

/**
 * Center panel: axis drop zones on top, the live chart below, and the PPTX
 * export action. Editing data or dragging a block updates the document store,
 * which re-renders the chart here in real time.
 */
export default function CanvasPanel() {
  const table = useDocumentStore((s) => s.table);
  const chart = useDocumentStore((s) => s.chart);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const theme = useThemeStore((s) => s.theme);

  const [exporting, setExporting] = useState(false);

  const hasChart = Boolean(table && chart.series.length > 0);

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
            <AxisZone axis="x" label="X축 (분류)" table={table} chart={chart} />
            <AxisZone axis="yLeft" label="Y축 좌 (값)" table={table} chart={chart} />
            <AxisZone axis="yRight" label="Y축 우 (값)" table={table} chart={chart} />
          </>
        ) : (
          <div className="dropzone" style={{ gridColumn: '1 / -1' }}>
            <span className="hint">데이터를 업로드하면 축 설정 영역이 활성화됩니다.</span>
          </div>
        )}
      </div>

      <div className="card chart-card">
        <div className="chart-card__head">
          <input
            className="chart-card__title-input"
            placeholder="차트 제목을 입력하세요"
            value={chart.title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className="btn--primary"
            onClick={handleExport}
            disabled={!hasChart || exporting}
            title={hasChart ? '수정 가능한 PPT로 내보내기' : '먼저 Y축에 데이터를 추가하세요'}
          >
            {exporting ? '생성 중…' : 'PPT 다운로드'}
          </button>
        </div>

        {hasChart && table ? (
          <ChartView table={table} chart={chart} theme={theme} />
        ) : (
          <div className="empty">
            <strong>차트 미리보기</strong>
            <span>좌측 컬럼 블록을 Y축 영역으로 끌어다 놓으면 차트가 즉시 그려집니다.</span>
          </div>
        )}
      </div>
    </section>
  );
}
