// Redacts secrets from logs, runner output and mirrored files (SPEC-05 section 7 S-32, S-33, S-86).

const SENSITIVE_KEYWORD_RE =
  /(?:secret|password|passwd|pwd|token|api[_-]?key|private[_-]?key|credential|auth|dsn|connection[_-]?string)/i;

const SENSITIVE_ASSIGNMENT_PATTERN =
  /((?:(["'])([A-Za-z0-9_.-]+)\2|(?<![A-Za-z0-9_.-])([A-Za-z0-9_.-]+))\s*[:=]\s*(["']?))([^"'\s,;}\]]{3,})(\5)/g;

const CONNECTION_STRING_PASSWORD = /(?<=:\/\/[^:\s]+:)[^@\s]+(?=@)/g;
const AWS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/g;
const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/g;
const OPENAI_OR_ANTHROPIC_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{20,}\b/g;
const GITHUB_PAT_PATTERN = /\bghp_[A-Za-z0-9]{36}\b/g;
const SLACK_TOKEN_PATTERN = /\bxox[baprs]-[A-Za-z0-9-]+\b/g;

/**
 * Redacts secrets from text according to S-33:
 * - String assignments to sensitive names (password, token, api_key, etc.)
 * - Known secret patterns (AWS, private keys, OpenAI/Anthropic, GitHub PAT, Slack tokens, connection strings)
 */
export function redactSecrets(text: string): string {
  if (!text) return text;

  let result = text;
  result = result.replace(CONNECTION_STRING_PASSWORD, '«redacted»');
  result = result.replace(
    SENSITIVE_ASSIGNMENT_PATTERN,
    (
      match: string,
      prefix: string,
      _qKey: string | undefined,
      key1: string | undefined,
      key2: string | undefined,
      _qVal: string | undefined,
      _val: string | undefined,
      qValEnd: string | undefined,
    ): string => {
      const key = key1 ?? key2;
      if (key !== undefined && SENSITIVE_KEYWORD_RE.test(key)) {
        return `${prefix}«redacted»${qValEnd ?? ''}`;
      }
      return match;
    },
  );
  result = result.replace(AWS_KEY_PATTERN, '«redacted»');
  result = result.replace(PRIVATE_KEY_PATTERN, '«redacted»');
  result = result.replace(OPENAI_OR_ANTHROPIC_KEY_PATTERN, '«redacted»');
  result = result.replace(GITHUB_PAT_PATTERN, '«redacted»');
  result = result.replace(SLACK_TOKEN_PATTERN, '«redacted»');

  return result;
}
