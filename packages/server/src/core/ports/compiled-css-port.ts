// CompiledCssPort: the CSS a stylesheet module compiles to in the project's dev server, with its
// inline source map (SPEC-04 M-ST, R-ST-04). Core uses it to map a rule back to its source line.

export interface CompiledCssPort {
  /**
   * The compiled text of the stylesheet with this dev server id (an absolute file path, as in
   * `data-vite-dev-id`); undefined when the dev server is not running or does not answer in time.
   */
  read(sheetId: string): Promise<string | undefined>;
}
