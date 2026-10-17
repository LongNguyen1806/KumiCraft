export function cn(...inputs: (string | false | undefined)[]): string {
  return inputs.filter(Boolean).join(' ');
}
