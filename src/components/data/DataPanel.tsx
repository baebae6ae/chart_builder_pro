import { useRef } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useImportStore } from '@/store/importStore';
import { useThemeStore } from '@/store/themeStore';
import ColumnBlock from './ColumnBlock';

/**
 * Left panel: data ingest, corporate theming, and the draggable column blocks.
 * It only wires UI to store actions — no data shaping happens here.
 */
export default function DataPanel() {
  const table = useDocumentStore((s) => s.table);
  const loadFile = useImportStore((s) => s.loadFile);

  const theme = useThemeStore((s) => s.theme);
  const themeStatus = useThemeStore((s) => s.status);
  const applyTheme = useThemeStore((s) => s.applyFromFile);
  const setColor = useThemeStore((s) => s.setColor);

  const dataInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="panel panel--data">
      <div className="section">
        <h2 className="section__title">데이터</h2>
        <div className="upload-row">
          <label className="file-btn">
            엑셀 / CSV 업로드
            <input
              ref={dataInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = '';
              }}
            />
          </label>
          <p className="hint">
            병합 셀·다중 헤더가 있어도 괜찮습니다. 업로드 후 헤더 행과 영역을
            직접 지정할 수 있어요.
          </p>
        </div>
      </div>

      <div className="section">
        <h2 className="section__title">사내 테마 (CI)</h2>
        <div className="upload-row">
          <label className="file-btn">
            로고 이미지 / PPT 템플릿 업로드
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.pptx,.potx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) applyTheme(file);
                e.target.value = '';
              }}
            />
          </label>
          {themeStatus === 'extracting' && <span className="tag">색상 추출 중…</span>}
          {themeStatus === 'error' && (
            <span className="tag" style={{ color: 'var(--danger)' }}>
              추출 실패 — 기본 테마 유지
            </span>
          )}
          <div>
            <span className="hint">팔레트: {theme.name}</span>
            <div className="swatches">
              {theme.colors.map((color, i) => (
                <label key={i} className="swatch" style={{ background: color }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(i, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="section" style={{ flex: 1 }}>
        <h2 className="section__title">컬럼 블록</h2>
        {table && table.columns.length > 0 ? (
          <>
            <p className="hint" style={{ marginBottom: 10 }}>
              블록을 오른쪽 X/Y축 영역으로 끌어다 놓으세요.
            </p>
            <div className="blocks">
              {table.columns.map((column) => (
                <ColumnBlock key={column.id} column={column} />
              ))}
            </div>
          </>
        ) : (
          <p className="hint">데이터를 업로드하면 컬럼이 여기에 나타납니다.</p>
        )}
      </div>
    </aside>
  );
}
