import { useDocumentStore } from '@/store/documentStore';
import { useThemeStore } from '@/store/themeStore';
import VizRenderer from '@/components/common/VizRenderer';

/**
 * Auto-suggestion gallery. After an upload the app profiles the data and offers
 * ready-made visualizations as live preview cards; picking one loads it into the
 * editor. This is the "upload anything, see good charts, take the ones you like"
 * entry point — it reads suggestions from the document store and holds no state.
 */
export default function SuggestionGallery({ onPick }: { onPick: () => void }) {
  const table = useDocumentStore((s) => s.table);
  const suggestions = useDocumentStore((s) => s.suggestions);
  const apply = useDocumentStore((s) => s.applySuggestion);
  const theme = useThemeStore((s) => s.theme);

  if (!table) return null;

  if (suggestions.length === 0) {
    return (
      <div className="empty">
        <strong>추천할 시각화를 찾지 못했어요</strong>
        <span>‘직접 편집’ 탭에서 분류·값을 직접 배치해 보세요.</span>
      </div>
    );
  }

  const choose = (chartConfig: (typeof suggestions)[number]['chart']) => {
    apply(chartConfig);
    onPick();
  };

  return (
    <div className="suggest-grid">
      {suggestions.map((sug) => (
        <button key={sug.id} className="suggest-card" onClick={() => choose(sug.chart)}>
          <div className="suggest-card__head">
            <span className="suggest-card__title">{sug.title}</span>
            <span className="suggest-card__reason">{sug.reason}</span>
          </div>
          <div className="suggest-card__preview">
            <VizRenderer table={table} chart={sug.chart} theme={theme} />
          </div>
          <span className="suggest-card__cta">이 시각화 사용 →</span>
        </button>
      ))}
    </div>
  );
}
