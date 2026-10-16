// V-112: one message between Bridge and Studio is at most 1 MB as JSON.
export const MAX_MESSAGE_BYTES = 1024 * 1024;

const encoder = new TextEncoder();

/** True when the message fits; larger ones are not sent (`tree` stays below it by V-113). */
export function fitsMessageLimit(message: unknown): boolean {
  return encoder.encode(JSON.stringify(message)).byteLength <= MAX_MESSAGE_BYTES;
}
