export interface DateRangePreset {
  label: string;
  getFromDate: () => string;
  getToDate: () => string;
}

export const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDateRangePresets = (): { [key: string]: { label: string; from: string; to: string } } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // This Month
  const thisMonthFrom = formatDate(new Date(year, month, 1));
  const thisMonthTo = formatDate(new Date(year, month + 1, 0));

  // Last Month
  const lastMonthFrom = formatDate(new Date(year, month - 1, 1));
  const lastMonthTo = formatDate(new Date(year, month, 0));

  // This Year
  const thisYearFrom = `${year}-01-01`;
  const thisYearTo = `${year}-12-31`;

  // Last Year
  const lastYearFrom = `${year - 1}-01-01`;
  const lastYearTo = `${year - 1}-12-31`;

  return {
    thisMonth: { label: 'This Month', from: thisMonthFrom, to: thisMonthTo },
    lastMonth: { label: 'Last Month', from: lastMonthFrom, to: lastMonthTo },
    thisYear: { label: 'This Year', from: thisYearFrom, to: thisYearTo },
    lastYear: { label: 'Last Year', from: lastYearFrom, to: lastYearTo },
    allTime: { label: 'All Time', from: '', to: '' }
  };
};
