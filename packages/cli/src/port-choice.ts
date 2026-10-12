// Which port each start attempt uses (SPEC-05 S-02).

// S-02: random port in the dynamic range, away from well-known ports.
const PORT_RANGE_START = 49152;
const PORT_RANGE_SIZE = 65535 - PORT_RANGE_START + 1;

export const MAX_PORT_ATTEMPTS = 10;

export const randomPort = (): number =>
  PORT_RANGE_START + Math.floor(Math.random() * PORT_RANGE_SIZE);

export type PortPlan = {
  /** `--port`: the only port tried. */
  readonly fixed: number | undefined;
  /** Port of the last session in this workspace: tried first, so the Studio keeps its address. */
  readonly remembered: number | undefined;
};

export const attemptsFor = (plan: PortPlan): number =>
  plan.fixed === undefined ? MAX_PORT_ATTEMPTS : 1;

/** Port of attempt `attempt` (1-based); `random` is injected for tests. */
export function portFor(
  attempt: number,
  plan: PortPlan,
  random: () => number = randomPort,
): number {
  if (plan.fixed !== undefined) return plan.fixed;
  return attempt === 1 && plan.remembered !== undefined ? plan.remembered : random();
}
