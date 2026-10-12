const STAMP = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-\d{3}$/;

/** A backup time stamp (UTC, `YYYYMMDD-HHmmss-SSS`) as a local date and time. */
export function formatBackupTime(stamp: string, language: string): string {
  const parts = STAMP.exec(stamp)?.slice(1).map(Number);
  if (parts?.length !== 6) return stamp;
  const [year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0] = parts;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toLocaleString(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
