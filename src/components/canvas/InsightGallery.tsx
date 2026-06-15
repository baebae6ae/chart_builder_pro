import { useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useThemeStore } from '@/store/themeStore';
import { exportDeckToPptx } from '@/lib/export/pptx';
import VizRenderer from '@/components/common/VizRenderer';

/**
 * Insight gallery — the "upload anything → see compelling charts → pick the ones
 * you like → download a deck" entry point. Each card is a self-contained,
 * auto-generated {@link Insight} (its own table + chart) with a plain-language
 * caption. Users multi-select favorites, optionally compare them side by side,
 * and export the selection as a PPTX deck. Reads everything from the store.
 */
export default function InsightGallery({ onOpen }: { onOpen: () => void }) {
  const table = useDocumentStore((s) => s.table);
  const insights = useDocumentStore((s) => s.insights);
  const selectedIds = useDocumentStore((s) => s.selectedInsightIds);
  const toggle = useDocumentStore((s) => s.toggleInsightSelected);
  const clearSelection = useDocumentStore((s) => s.clearInsightSelection);
  const applyInsight = useDocumentStore((s) => s.applyInsight);
  const theme = useThemeStore((s) => s.theme);

  const [exporting, setExporting] = useState(false);
  const [compare, setCompare] = useState(false);

  if (!table) return null;

  if (insights.length === 0) {
    return (
      <div className="empty">
        <strong>추천할 시각화를 찾지 못했어요</strong>
        <span>‘직접 편집’ 탭에서 분류·값을 직접 배치해 보세요.</span>
      </div>
    );
  }

  const selected = insights.filter((i) => selectedIds.includes(i.id));
  const showCompare = compare && selected.length >= 2;

  const handleDeck = async () => {
    if (selected.length === 0) return;
    setExporting(true);
    try {
      await exportDeckToPptx(selected, theme, 'chart-builder-pro-deck.pptx');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="gallery-bar">
        <span className="muted">
          추천 {insights.length}개 · 선택 {selected.length}개
        </span>
        <div className="app__header-spacer" />
        <button
          className={showCompare ? 'btn--primary' : undefined}
          disabled={selected.length < 2}
          onClick={() => setCompare((c) => !c)}
          title="선택한 항목을 나란히 비교"
        >
          {showCompare ? '비교 닫기' : '비교 보기'}
        </button>
        <button onClick={clearSelection} disabled={selected.length === 0}>
          선택 해제
        </button>
        <button
          className="btn--primary"
          disabled={selected.length === 0 || exporting}
          onClick={handleDeck}
        >
          {exporting ? '생성 중…' : `선택 ${selected.length}개 PPT 다운로드`}
        </button>
      </div>

      {showCompare ? (
        <div className="insight-compare">
          {selected.slice(0, 4).map((ins) => (
            <div className="compare-pane" key={ins.id}>
              <div className="compare-pane__head">{ins.title}</div>
              <VizRenderer table={ins.table} chart={ins.chart} theme={theme} />
            </div>
          ))}
        </div>
      ) : (
        <div className="suggest-grid">
          {insights.map((ins) => {
            const isSel = selectedIds.includes(ins.id);
            return (
              <div key={ins.id} className={`suggest-card${isSel ? ' suggest-card--selected' : ''}`}>
                <div className="suggest-card__head">
                  <div className="suggest-card__titlerow">
                    <span className="suggest-card__title">{ins.title}</span>
                    <label className="pick" title="비교·내보내기용 선택">
                      <input type="checkbox" checked={isSel} onChange={() => toggle(ins.id)} />
                      선택
                    </label>
                  </div>
                  <span className="suggest-card__reason">{ins.caption}</span>
                </div>
                <div className="suggest-card__preview">
                  <VizRenderer table={ins.table} chart={ins.chart} theme={theme} />
                </div>
                <button
                  className="suggest-card__cta"
                  onClick={() => {
                    applyInsight(ins);
                    onOpen();
                  }}
                >
                  편집에서 열기 →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
