// SystemPort: facts about the running process, injected so tests can play other processes.

export interface SystemPort {
  readonly pid: number;
  readonly hostname: string;
  now(): Date;
  /** Whether a process with this id still runs on this machine (stale workspace locks). */
  isProcessAlive(pid: number): boolean;
  /** Whether something accepts connections on this port of 127.0.0.1 (stale workspace locks). */
  isListening(port: number): Promise<boolean>;
}
