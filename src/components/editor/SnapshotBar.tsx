import { useDocumentStore } from '@/store/documentStore';
import { useSnapshotStore } from '@/store/snapshotStore';

/**
 * Snapshot controls: freeze the current document as a named scenario, then pick
 * up to two scenarios for the A/B compare board. Saving and selecting are the
 * only interactions — the actual side-by-side render lives in CompareBoard.
 */
export default function SnapshotBar() {
  const table = useDocumentStore((s) => s.table);
  const chart = useDocumentStore((s) => s.chart);
  const loadDocument = useDocumentStore((s) => s.loadDocument);

  const snapshots = useSnapshotStore((s) => s.snapshots);
  const compare = useSnapshotStore((s) => s.compare);
  const capture = useSnapshotStore((s) => s.capture);
  const remove = useSnapshotStore((s) => s.remove);
  const rename = useSnapshotStore((s) => s.rename);
  const toggleCompare = useSnapshotStore((s) => s.toggleCompare);

  const handleCapture = () => {
    if (!table) return;
    const name = window.prompt('스냅샷 이름', `시나리오 ${snapshots.length + 1}`);
    if (name === null) return;
    capture(name, table, chart);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button className="btn--primary" onClick={handleCapture} disabled={!table}>
          + 스냅샷 저장
        </button>
        <span className="hint">
          비교할 시나리오를 최대 2개까지 선택하면 위 비교 보드에 나란히 표시됩니다.
        </span>
      </div>

      {snapshots.length === 0 ? (
        <p className="hint">
          저장된 스냅샷이 없습니다. 데이터를 수정한 뒤 현재 상태를 저장해 보세요.
        </p>
      ) : (
        <div className="snap-list">
          {snapshots.map((snap) => {
            const selected = compare.includes(snap.id);
            return (
              <div key={snap.id} className={`snap${selected ? ' snap--selected' : ''}`}>
                <input
                  className="snap__name"
                  value={snap.name}
                  onChange={(e) => rename(snap.id, e.target.value)}
                />
                <button
                  className="btn--ghost"
                  title="비교 보드에 표시"
                  onClick={() => toggleCompare(snap.id)}
                >
                  {selected ? '비교 해제' : '비교'}
                </button>
                <button
                  className="btn--ghost"
                  title="이 스냅샷을 편집기로 불러오기"
                  onClick={() => loadDocument(snap.table, snap.chart)}
                >
                  불러오기
                </button>
                <button className="chip__x" title="삭제" onClick={() => remove(snap.id)}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
