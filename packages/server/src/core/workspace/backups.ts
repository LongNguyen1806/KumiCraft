// Backup naming shared by migration (SPEC-04.1 section 2.3) and the design store (section 3).
import { WORKSPACE_DIR } from '@reactcraft/model';

export const BACKUP_DIR = `${WORKSPACE_DIR}/backups`;

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

/** `YYYYMMDD-HHmmss-SSS` in UTC: sorts by time and is the same on every machine. */
export function backupStamp(date: Date): string {
  const day = `${String(date.getUTCFullYear())}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  const time = `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
  return `${day}-${time}-${pad(date.getUTCMilliseconds(), 3)}`;
}
