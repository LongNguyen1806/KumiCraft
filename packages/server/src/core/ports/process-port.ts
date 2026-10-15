// ProcessPort (SPEC-01 section 3.2, S-50, S-51): the only way core executes external commands.
// Commands and args are fixed arrays, never passed to shell.
export type ProcessOutput = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly lines: readonly string[];
};

export type ChildProcessHandle = {
  readonly pid?: number | undefined;
  onLine(callback: (line: string) => void): void;
  send?(message: unknown): boolean;
  onMessage?(callback: (message: unknown) => void): void;
  wait(): Promise<ProcessOutput>;
  kill(): Promise<void>;
};

export type SpawnOptions = {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>> | undefined;
  readonly timeoutMs?: number | undefined;
  readonly ipc?: boolean | undefined;
};

export interface ProcessPort {
  spawn(command: string, args: readonly string[], options: SpawnOptions): ChildProcessHandle;
}
