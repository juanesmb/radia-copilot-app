export const getMonthPeriodStart = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return periodStart.toISOString().slice(0, 10);
};
