import { useSnapshotStore } from '@/store/snapshotStore';
import { useThemeStore } from '@/store/themeStore';
import type { Snapshot } from '@/types';
import VizRenderer from '@/components/common/VizRenderer';

/**
 * A/B split view: renders the two selected snapshots side by side using the
 * same global theme, so "before vs after" scenarios are compared on equal
 * visual footing. Any visualization type renders through the shared
 * VizRenderer. Reads selection from the snapshot store; holds no state.
 */
function Pane({ snapshot }: { snapshot: Snapshot | undefined }) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div className="compare-pane">
      <div className="compare-pane__head">{snapshot ? snapshot.name : '미선택'}</div>
      {snapshot ? (
        <VizRenderer table={snapshot.table} chart={snapshot.chart} theme={theme} />
      ) : (
        <div className="empty">
          <span>아래 목록에서 비교할 시나리오를 선택하세요.</span>
        </div>
      )}
    </div>
  );
}

export default function CompareBoard() {
  // Subscribe to both selection and the snapshot list so renames/edits to a
  // compared scenario re-render the panes.
  const compare = useSnapshotStore((s) => s.compare);
  const snapshots = useSnapshotStore((s) => s.snapshots);

  const find = (id: string | null) => snapshots.find((s) => s.id === id);

  return (
    <div className="compare-board">
      <Pane snapshot={find(compare[0])} />
      <Pane snapshot={find(compare[1])} />
    </div>
  );
}
