export function formatCustomerCreatedDate(value: Date | string | number | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function parseBangkokDate(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const date = new Date(`${value}${endOfDay ? "T23:59:59.999+07:00" : "T00:00:00.000+07:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function getCustomerCreationDateRange(start?: string, end?: string) {
  return {
    start: parseBangkokDate(start, false),
    end: parseBangkokDate(end, true),
  };
}
