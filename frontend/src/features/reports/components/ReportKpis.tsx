interface ReportKpi {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}

const tones = {
  neutral: 'text-[#0B2545]',
  positive: 'text-emerald-700',
  negative: 'text-rose-700',
};

export function ReportKpis({ items }: { items: ReportKpi[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value, tone = 'neutral' }) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd className={`mt-2 text-xl font-semibold tracking-tight tabular-nums ${tones[tone]}`}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
