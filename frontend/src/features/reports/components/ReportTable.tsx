import React, { ReactNode } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  render?: (row: T, index: number) => ReactNode;
}

export interface ReportTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  /** Optional row key extractor (default: index) */
  rowKey?: (row: T, index: number) => string | number;
  /** Custom row renderer; if not provided, columns render/row[key] is used */
  renderRow?: (row: T, index: number) => ReactNode;
  /** Optional summary/totals row at footer */
  renderTotals?: () => ReactNode;
  /** Optional extra classes on table container */
  className?: string;
}

export function ReportTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records match the selected filter criteria.',
  rowKey,
  renderRow,
  renderTotals,
  className = '',
}: ReportTableProps<T>) {
  return (
    <div className={`w-full bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden ${className}`}>
      {/* 
        ── Horizontal Scroller (Landscape Layout Container) ──
        Ensures wide report tables never squash or wrap contents awkwardly vertically.
      */}
      <div className="w-full overflow-x-auto min-w-full">
        <table className="report-records w-full text-xs text-left text-slate-700 whitespace-nowrap border-collapse">
          {/* Header row with light blue-gray background matching reference */}
          <thead className="bg-[#EBF1FA] text-slate-800 font-bold border-b border-slate-200 text-[11px] tracking-wide uppercase">
            <tr>
              {/* Sequential Row Index Column (#) */}
              <th className="py-2.5 px-3 text-center border-r border-slate-200/80 w-12 text-slate-600">
                #
              </th>
              {columns.map((col) => {
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={`py-2.5 px-3 border-r border-slate-200/80 last:border-r-0 ${alignClass} ${col.className || ''}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100/90">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="py-12 text-center text-slate-400 font-medium"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-100 border-t-[#2254E1] animate-spin mb-1" />
                    <span>Loading report records…</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="py-12 text-center text-slate-400 font-medium italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : renderRow ? (
              data.map((row, idx) => (
                <React.Fragment key={rowKey ? rowKey(row, idx) : idx}>
                  {renderRow(row, idx)}
                </React.Fragment>
              ))
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row, idx) : idx}
                  className="hover:bg-blue-50/40 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  {/* Row index (#) */}
                  <td className="py-2.5 px-3 text-center text-slate-500 font-medium border-r border-slate-100 w-12">
                    {idx + 1}
                  </td>
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    const val = (row as any)[col.key];

                    return (
                      <td
                        key={col.key}
                        className={`py-2.5 px-3 border-r border-slate-100 last:border-r-0 ${alignClass} ${col.className || ''}`}
                      >
                        {col.render ? col.render(row, idx) : val !== undefined && val !== null ? String(val) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>

          {/* Footer Totals Row (Optional) */}
          {renderTotals && (
            <tfoot className="bg-slate-50/90 font-bold text-slate-900 border-t-2 border-slate-200">
              {renderTotals()}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
