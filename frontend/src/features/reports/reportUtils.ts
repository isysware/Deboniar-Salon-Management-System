// Shared helpers for the read-only spec reports (spec §1 universal controls, §8.2 export rules).

export const formatSignedPKR = (amount: number) => (Number(amount) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type DatePreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'TODAY', label: 'Today' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'THIS_WEEK', label: 'This Week' },
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'LAST_MONTH', label: 'Last Month' },
  { id: 'CUSTOM', label: 'Custom Range' },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Resolve a preset against the business date (YYYY-MM-DD). Week starts Monday. */
export const resolvePreset = (preset: DatePreset, businessDate: string): { from: string; to: string } | null => {
  const [y, m, d] = businessDate.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  switch (preset) {
    case 'TODAY':
      return { from: businessDate, to: businessDate };
    case 'YESTERDAY': {
      const p = new Date(y, m - 1, d - 1);
      return { from: ymd(p), to: ymd(p) };
    }
    case 'THIS_WEEK': {
      const offset = (today.getDay() + 6) % 7;
      return { from: ymd(new Date(y, m - 1, d - offset)), to: businessDate };
    }
    case 'THIS_MONTH':
      return { from: ymd(new Date(y, m - 1, 1)), to: businessDate };
    case 'LAST_MONTH':
      return { from: ymd(new Date(y, m - 2, 1)), to: ymd(new Date(y, m - 1, 0)) };
    default:
      return null;
  }
};

/** 'YYYY-MM' → 'Oct 2026'. */
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

const cell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Standard CSV export: metadata block, headers, typed rows.
 */
export const downloadReportCsv = (
  fileName: string,
  meta: [string, string][],
  sections: { title?: string; headers: string[]; rows: unknown[][] }[]
) => {
  const lines: string[] = meta.map(([k, v]) => `${cell(k)},${cell(v)}`);
  for (const s of sections) {
    lines.push('');
    if (s.title) lines.push(cell(s.title));
    lines.push(s.headers.map(cell).join(','));
    for (const r of s.rows) lines.push(r.map(cell).join(','));
  }
  const cleanName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/**
 * Excel spreadsheet export (BOM-encoded CSV for Excel native compatibility).
 */
export const downloadReportExcel = (
  fileName: string,
  meta: [string, string][],
  sections: { title?: string; headers: string[]; rows: unknown[][] }[]
) => {
  const cleanName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  downloadReportCsv(cleanName, meta, sections);
};

/**
 * Opens a dedicated printable window with salon branding, metadata,
 * dense tabular format, and triggers the print dialog (for Print & PDF save).
 */
export const printReportWindow = ({
  title,
  subtitle,
  meta = [],
  headers,
  rows,
  totals,
}: {
  title: string;
  subtitle?: string;
  meta?: [string, string][];
  headers: string[];
  rows: (string | number | null | undefined)[][];
  totals?: (string | number | null | undefined)[];
}) => {
  const printWin = window.open('', '_blank');
  if (!printWin) {
    window.print();
    return;
  }

  const metaHtml = meta
    .map(
      ([k, v]) =>
        `<div style="font-size:11px;color:#475569;"><strong style="color:#0f172a;">${k}:</strong> ${v}</div>`
    )
    .join('');

  const hasIndexHeader = headers[0] === '#';
  const displayHeaders = hasIndexHeader ? headers : ['#', ...headers];
  const headersHtml = `<tr>
    ${displayHeaders
      .map(
        (h, i) =>
          `<th style="padding:6px 8px;border:1px solid #cbd5e1;background:#ebf1fa;color:#1e293b;font-size:11px;text-align:${i === 0 ? 'center' : 'left'};width:${i === 0 ? '32px' : 'auto'};">${h}</th>`
      )
      .join('')}
  </tr>`;

  const rowsHtml = rows
    .map(
      (r, idx) => {
        const displayRow = hasIndexHeader ? r : [idx + 1, ...r];
        return `<tr>
          ${displayRow
            .map((c, colIdx) => {
              const isNum = colIdx > 0 && (typeof c === 'number' || (typeof c === 'string' && /^[+-]?[\d,]+(\.\d+)?$/.test(String(c).trim())));
              return `<td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:11px;text-align:${colIdx === 0 ? 'center' : isNum ? 'right' : 'left'};">${c ?? '—'}</td>`;
            })
            .join('')}
        </tr>`;
      }
    )
    .join('');

  const totalsHtml = totals
    ? `<tr style="font-weight:bold;background:#f8fafc;">
        ${(hasIndexHeader && totals.length === displayHeaders.length ? totals : ['Total', ...totals])
          .map((c, colIdx) => {
            const isNum = colIdx > 0 && (typeof c === 'number' || (typeof c === 'string' && /^[+-]?[\d,]+(\.\d+)?$/.test(String(c).trim())));
            return `<td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:${colIdx === 0 ? 'center' : isNum ? 'right' : 'left'};font-size:11px;">${c ?? ''}</td>`;
          })
          .join('')}
      </tr>`
    : '';

  printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - SalonOS</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @media print {
      @page { size: landscape; margin: 10mm; }
      body { margin: 0; }
    }
    body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  </style>
</head>
<body>
  <div style="border-bottom: 2px solid #0047AB; padding-bottom: 8px; margin-bottom: 12px; display:flex; justify-content:space-between; align-items:flex-end;">
    <div>
      <h1 style="margin:0;font-size:20px;color:#0047AB;">SalonOS — ${title}</h1>
      ${subtitle ? `<p style="margin:3px 0 0;font-size:12px;color:#64748b;">${subtitle}</p>` : ''}
    </div>
    <div style="font-size:11px;color:#64748b;text-align:right;">
      Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:6px;background:#f8fafc;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;">
    ${metaHtml}
  </div>

  <table>
    <thead>${headersHtml}</thead>
    <tbody>${rowsHtml}</tbody>
    ${totalsHtml ? `<tfoot>${totalsHtml}</tfoot>` : ''}
  </table>

  <script>
    window.onload = function() { document.fonts.ready.then(function() { window.print(); }); }
  </script>
</body>
</html>`);
  printWin.document.close();
};
