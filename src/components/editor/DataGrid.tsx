import { useDocumentStore } from '@/store/documentStore';

/**
 * Editable spreadsheet for the working dataset. Every edit flows through the
 * document store, so the live chart re-renders on the next keystroke — this is
 * the "real-time editor" half of the spec. Kept deliberately lightweight (a
 * controlled <table>) to stay fast and dependency-free for typical decks.
 */
export default function DataGrid() {
  const table = useDocumentStore((s) => s.table);
  const updateCell = useDocumentStore((s) => s.updateCell);
  const renameColumn = useDocumentStore((s) => s.renameColumn);
  const addRow = useDocumentStore((s) => s.addRow);
  const deleteRow = useDocumentStore((s) => s.deleteRow);

  if (!table) {
    return <p className="hint">데이터를 업로드하면 여기서 직접 수정할 수 있습니다.</p>;
  }

  return (
    <div>
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
          {table.rows.map((row, r) => (
            <tr key={r}>
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
          ))}
        </tbody>
      </table>
      <button className="btn--ghost" style={{ marginTop: 8 }} onClick={addRow}>
        + 행 추가
      </button>
    </div>
  );
}
