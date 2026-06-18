import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';

/**
 * Editable spreadsheet for the working dataset. Every edit flows through the
 * document store, so the live chart re-renders on the next keystroke.
 *
 * Rows are *virtualized*: only the rows in (and just around) the viewport are
 * mounted, with top/bottom spacer rows preserving the scrollbar. This keeps the
 * grid responsive on datasets with thousands of rows without any extra deps.
 * The row height is measured from a real row, so the windowing math stays exact
 * regardless of font/border styling.
 */
const OVERSCAN = 6;

export default function DataGrid() {
  const table = useDocumentStore((s) => s.table);
  const updateCell = useDocumentStore((s) => s.updateCell);
  const renameColumn = useDocumentStore((s) => s.renameColumn);
  const addRow = useDocumentStore((s) => s.addRow);
  const deleteRow = useDocumentStore((s) => s.deleteRow);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(480);
  const [rowH, setRowH] = useState(32);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    setViewport(el.clientHeight);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  // Self-calibrate the row height from a mounted row.
  useLayoutEffect(() => {
    const h = rowRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - rowH) > 0.5) setRowH(h);
  });

  if (!table) {
    return (
      <div className="grid-wrap">
        <p className="hint" style={{ padding: '10px 12px' }}>
          데이터를 업로드하면 여기서 직접 수정할 수 있습니다.
        </p>
      </div>
    );
  }

  const total = table.rows.length;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + viewport) / rowH) + OVERSCAN);
  const padTop = start * rowH;
  const padBottom = Math.max(0, (total - end) * rowH);
  const colSpan = table.columns.length + 2;

  return (
    <div className="grid-wrap">
      <div className="grid-scroll" ref={scrollRef}>
        <table className="grid">
          <thead>
            <tr>
              <th className="grid__corner" />
              {table.columns.map((col) => (
                <th key={col.id}>
                  <input
                    className="grid__head-input"
                    value={col.name}
                    onChange={(e) => renameColumn(col.id, e.target.value)}
                  />
                </th>
              ))}
              <th className="grid__corner" />
            </tr>
          </thead>
          <tbody>
            {padTop > 0 && (
              <tr aria-hidden className="grid__spacer">
                <td colSpan={colSpan} style={{ height: padTop }} />
              </tr>
            )}
            {table.rows.slice(start, end).map((row, i) => {
              const r = start + i;
              return (
                <tr key={r} ref={i === 0 ? rowRef : undefined}>
                  <td className="grid__rownum">{r + 1}</td>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <input
                        className={`grid__cell-input${
                          table.columns[c].type === 'number' ? ' grid__cell-input--num' : ''
                        }`}
                        value={cell === null ? '' : String(cell)}
                        onChange={(e) => updateCell(r, c, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button className="grid__del" title="행 삭제" onClick={() => deleteRow(r)}>
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
            {padBottom > 0 && (
              <tr aria-hidden className="grid__spacer">
                <td colSpan={colSpan} style={{ height: padBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="grid-foot">
        <button className="btn--ghost" onClick={addRow}>
          + 행 추가
        </button>
        <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
          {total.toLocaleString('ko-KR')}행
        </span>
      </div>
    </div>
  );
}
