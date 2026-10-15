// Vite adds `hot` to the modules it serves; the Bridge client reads it (R-BR-17).
interface ImportMeta {
  readonly hot?: { on(event: string, callback: (payload: unknown) => void): void } | undefined;
}
