// LoggerPort (SPEC-01 section 3.2, ADR-BE-23, QC-65): structured fields, never string building.
// Never log file content, design content, prompts, secrets or tokens (SPEC-05 S-89).

export interface LoggerPort {
  debug(fields: object, message: string): void;
  info(fields: object, message: string): void;
  warn(fields: object, message: string): void;
  error(fields: object, message: string): void;
  /** A logger that adds `bindings` to every entry, for example `{ module: 'M-PJ' }`. */
  child(bindings: object): LoggerPort;
}
