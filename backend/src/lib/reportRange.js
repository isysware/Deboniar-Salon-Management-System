// src/lib/reportRange.js
// Standardized reporting range, date presets, and unified payload schema.
// All calculations locked strictly to Asia/Karachi (UTC+5).

import { startOfDay, endOfDay, toDateString, nowKarachi } from './dates.js';
import { resolveReadBranch } from './scope.js';
import prisma from '../config/prisma.js';

export const DATE_PRESETS = {
  TODAY: 'TODAY',
  YESTERDAY: 'YESTERDAY',
  THIS_WEEK: 'THIS_WEEK',
  THIS_MONTH: 'THIS_MONTH',
  LAST_MONTH: 'LAST_MONTH',
  CUSTOM: 'CUSTOM',
};

/**
 * Calculate YYYY-MM-DD start and end strings in Asia/Karachi.
 */
export const resolvePresetDateRange = (preset, customFrom, customTo) => {
  const todayStr = toDateString(nowKarachi());
  const [year, month, day] = todayStr.split('-').map(Number);
  const now = new Date(year, month - 1, day);

  switch (preset) {
    case DATE_PRESETS.TODAY:
      return { fromStr: todayStr, toStr: todayStr };

    case DATE_PRESETS.YESTERDAY: {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      return { fromStr: yStr, toStr: yStr };
    }

    case DATE_PRESETS.THIS_WEEK: {
      // Monday as first day of business week
      const currentDay = now.getDay(); // 0 is Sunday
      const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
      const monday = new Date(now);
      monday.setDate(monday.getDate() + diffToMonday);
      const mStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      return { fromStr: mStr, toStr: todayStr };
    }

    case DATE_PRESETS.THIS_MONTH: {
      const startMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      return { fromStr: startMonth, toStr: todayStr };
    }

    case DATE_PRESETS.LAST_MONTH: {
      const lastMonthDate = new Date(year, month - 2, 1);
      const lmYear = lastMonthDate.getFullYear();
      const lmMonth = lastMonthDate.getMonth() + 1;
      const lastDay = new Date(lmYear, lmMonth, 0).getDate();
      const fromStr = `${lmYear}-${String(lmMonth).padStart(2, '0')}-01`;
      const toStr = `${lmYear}-${String(lmMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { fromStr, toStr };
    }

    case DATE_PRESETS.CUSTOM:
    default: {
      const fromStr = customFrom || `${year}-${String(month).padStart(2, '0')}-01`;
      const toStr = customTo || todayStr;
      return { fromStr, toStr };
    }
  }
};

/**
 * Resolves standard reporting context from request query:
 * - date range (as YYYY-MM-DD string and UTC Date boundaries)
 * - branch scope & branch name
 * - metadata for auditability
 */
export const resolveReportContext = async (user, query = {}, dateBasis = 'RECOGNITION') => {
  const preset = query.preset || (query.startDate || query.from ? DATE_PRESETS.CUSTOM : DATE_PRESETS.THIS_MONTH);
  const customFrom = query.startDate || query.from;
  const customTo = query.endDate || query.to;

  const { fromStr, toStr } = resolvePresetDateRange(preset, customFrom, customTo);
  const fromDate = startOfDay(fromStr);
  const toDate = endOfDay(toStr);

  const branchId = resolveReadBranch(user, query.branchId);
  let branchName = 'All Branches';

  if (branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true, city: true },
    });
    branchName = branch ? (branch.city ? `${branch.name} (${branch.city})` : branch.name) : 'Selected Branch';
  }

  const generatedBy = user?.name ? `${user.name} (${user.role})` : user?.email || 'System';
  const generatedAt = new Date().toISOString();

  return {
    branchId,
    branchName,
    preset,
    fromStr,
    toStr,
    fromDate,
    toDate,
    dateBasis,
    meta: {
      branchId: branchId || 'ALL',
      branchName,
      from: fromStr,
      to: toStr,
      preset,
      dateBasis,
      timezone: 'Asia/Karachi',
      generatedAt,
      generatedBy,
    },
  };
};

/**
 * Standard envelope response for all 11 reports.
 */
export const formatReportResponse = (meta, { kpis = {}, rows = [], totals = {}, ...rest } = {}) => ({
  meta,
  kpis,
  rows,
  totals,
  ...rest,
});
