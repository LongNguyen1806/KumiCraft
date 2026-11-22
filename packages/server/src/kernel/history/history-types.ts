// One file of an Undo step: its content and hash before and after (R-HI-04, R-HI-11).
export type HistoryFileChange = {
  readonly path: string;
  readonly before?: string | undefined;
  readonly after?: string | undefined;
  readonly beforeHash?: string | undefined;
  readonly afterHash?: string | undefined;
  readonly encoding?: 'base64' | undefined;
};
