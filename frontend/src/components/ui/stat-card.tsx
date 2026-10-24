import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trendText?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'purple';
  action?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trendText,
  trendDirection = 'neutral',
  tone = 'default',
  action,
  className,
}) => {
  const iconBgStyles = {
    default: 'bg-slate-100 text-slate-700',
    primary: 'bg-blue-50 text-[#2254E1]',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    purple: 'bg-indigo-50 text-indigo-700',
  };

  const trendStyles = {
    up: 'text-emerald-700',
    down: 'text-rose-700',
    neutral: 'text-slate-600',
  };

  return (
    <Card
      padding="md"
      className={cn(
        'relative overflow-hidden transition-all duration-150 hover:border-slate-300 flex flex-col justify-between h-full font-sans',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <div className="text-xl sm:text-2xl font-semibold text-slate-900 tabular-nums tracking-tight leading-tight">
            {value}
          </div>
        </div>
        {icon && (
          <div className={cn('p-2.5 rounded-lg shrink-0 mt-0.5', iconBgStyles[tone])}>
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trendText || action) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
          <div className="flex flex-wrap items-center gap-1.5 leading-normal">
            {trendText && (
              <span className={cn('font-semibold shrink-0', trendStyles[trendDirection])}>
                {trendText}
              </span>
            )}
            {subtitle && <span className="text-slate-500">{subtitle}</span>}
          </div>
          {action && <div className="shrink-0 ml-auto">{action}</div>}
        </div>
      )}
    </Card>
  );
};
