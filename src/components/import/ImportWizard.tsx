import { useImportStore } from '@/store/importStore';
import type { Region } from '@/lib/excel/parser';

/**
 * Smart-parsing modal. The user previews the raw sheet, clicks the header row,
 * and drags a rectangle over the cells to visualize. All selection lives in the
 * import store; nothing touches the working document until "확인". Only a window
 * of rows is rendered to stay responsive on large sheets.
 */
const MAX_PREVIEW_ROWS = 50;
const MAX_PREVIEW_COLS = 30;

const inRegion = (region: Region | null, r: number, c: number): boolean =>
  !!region &&
  r >= region.startRow &&
  r <= region.endRow &&
  c >= region.startCol &&
  c <= region.endCol;

export default function ImportWizard() {
  const open = useImportStore((s) => s.open);
  const sheets = useImportStore((s) => s.sheets);
  const activeSheet = useImportStore((s) => s.activeSheet);
  const headerRow = useImportStore((s) => s.headerRow);
  const region = useImportStore((s) => s.region);
  const status = useImportStore((s) => s.status);

  const selectSheet = useImportStore((s) => s.selectSheet);
  const setHeaderRow = useImportStore((s) => s.setHeaderRow);
  const setRegion = useImportStore((s) => s.setRegion);
  const cancel = useImportStore((s) => s.cancel);
  const confirm = useImportStore((s) => s.confirm);

  if (!open) return null;

  const sheet = sheets[activeSheet];
  const rowCount = Math.min(sheet?.cells.length ?? 0, MAX_PREVIEW_ROWS);
  const colCount = Math.min(sheet?.cells[0]?.length ?? 0, MAX_PREVIEW_COLS);

  /** Extend the selected region to include a clicked cell. */
  const extendRegion = (r: number, c: number) => {
    if (!region) return;
    setRegion({
      startRow: Math.min(region.startRow, r),
      endRow: Math.max(headerRow, r),
      startCol: Math.min(region.startCol, c),
      endCol: Math.max(region.endCol, c),
    });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal__head">
          <span className="modal__title">스마트 데이터 가져오기</span>
          <span className="hint">
            헤더 행을 클릭하고, 시각화할 영역을 드래그(클릭)로 지정하세요.
          </span>
        </div>

        <div className="modal__body">
          {status === 'reading' && <p className="hint">파일을 읽는 중…</p>}
          {status === 'error' && (
            <p className="hint" style={{ color: 'var(--danger)' }}>
              파일을 읽을 수 없습니다. 형식을 확인해 주세요.
            </p>
          )}

          {sheet && (
            <>
              <div className="modal__controls">
                {sheets.length > 1 && (
                  <label className="field">
                    시트
                    <select
                      value={activeSheet}
                      onChange={(e) => selectSheet(Number(e.target.value))}
                    >
                      {sheets.map((s, i) => (
                        <option key={s.sheetName} value={i}>
                          {s.sheetName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="field">
                  헤더 행
                  <span className="tag">{headerRow + 1}행</span>
                </div>
                <div className="field">
                  선택 영역
                  <span className="tag">
                    {region
                      ? `${region.endRow - headerRow}행 × ${
                          region.endCol - region.startCol + 1
                        }열`
                      : '-'}
                  </span>
                </div>
              </div>

              <div style={{ overflow: 'auto', maxHeight: '50vh' }}>
                <table className="preview">
                  <tbody>
                    {Array.from({ length: rowCount }, (_, r) => (
                      <tr
                        key={r}
                        className={r === headerRow ? 'preview__header' : undefined}
                      >
                        <td
                          className="preview__rownum"
                          title="이 행을 헤더로 지정"
                          onClick={() => setHeaderRow(r)}
                        >
                          {r + 1}
                        </td>
                        {Array.from({ length: colCount }, (_, c) => {
                          const value = sheet.cells[r]?.[c];
                          const selected = inRegion(region, r, c);
                          return (
                            <td
                              key={c}
                              className={
                                r !== headerRow && selected ? 'preview__in' : undefined
                              }
                              onClick={() =>
                                r === headerRow ? setHeaderRow(r) : extendRegion(r, c)
                              }
                            >
                              {value === null || value === undefined ? '' : String(value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint" style={{ marginTop: 8 }}>
                미리보기는 최대 {MAX_PREVIEW_ROWS}행 × {MAX_PREVIEW_COLS}열까지
                표시됩니다. 전체 데이터는 가져오기 후 편집기에서 확인하세요.
              </p>
            </>
          )}
        </div>

        <div className="modal__foot">
          <div className="app__header-spacer" />
          <button onClick={cancel}>취소</button>
          <button className="btn--primary" onClick={confirm} disabled={!sheet}>
            확인 — 데이터 불러오기
          </button>
        </div>
      </div>
    </div>
  );
}
