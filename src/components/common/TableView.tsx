import type { ReportTable } from '@/lib/chart/tableModel';
import { formatNumber } from '@/lib/util/format';

/**
 * Presentational report table. Receives an already-projected {@link ReportTable}
 * and just renders it; all column selection lives in `buildReportTable`.
 */
export default function TableView({ model }: { model: ReportTable }) {
  if (model.columns.length === 0) {
    return <div className="empty"><span>표시할 열이 없습니다.</span></div>;
  }

  return (
    <div className="report-scroll">
      <table className="report">
        <thead>
          <tr>
            {model.columns.map((col) => (
              <th key={col.id} className={col.type === 'number' ? 'report--num' : undefined}>
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const numeric = model.columns[c].type === 'number' && typeof cell === 'number';
                return (
                  <td key={c} className={numeric ? 'report--num' : undefined}>
                    {cell === null ? '' : numeric ? formatNumber(cell as number) : String(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
