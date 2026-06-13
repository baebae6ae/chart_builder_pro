import { useState } from 'react';
import DataGrid from './DataGrid';
import SnapshotBar from './SnapshotBar';
import CompareBoard from './CompareBoard';

type Tab = 'grid' | 'compare';

/**
 * Bottom panel hosting the two editor modes. The snapshot bar is always
 * visible (you can save/select scenarios from either tab); the body switches
 * between the live data grid and the A/B comparison board.
 */
export default function EditorPanel() {
  const [tab, setTab] = useState<Tab>('grid');

  return (
    <section className="panel panel--editor">
      <div className="editor-tabs">
        <button
          className={`editor-tab${tab === 'grid' ? ' editor-tab--active' : ''}`}
          onClick={() => setTab('grid')}
        >
          데이터 편집기
        </button>
        <button
          className={`editor-tab${tab === 'compare' ? ' editor-tab--active' : ''}`}
          onClick={() => setTab('compare')}
        >
          시나리오 비교
        </button>
      </div>
      <div className="editor-body">
        {tab === 'grid' ? <DataGrid /> : <CompareBoard />}
      </div>
      <div className="section" style={{ borderBottom: 'none', borderTop: '1px solid var(--border)' }}>
        <SnapshotBar />
      </div>
    </section>
  );
}
