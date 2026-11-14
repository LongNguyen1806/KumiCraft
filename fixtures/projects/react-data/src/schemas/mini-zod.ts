const chain = () => ({
  min: () => chain(),
  email: () => chain(),
  optional: () => chain(),
});

export const z = {
  object: <T extends Record<string, unknown>>(shape: T) => shape,
  string: () => chain(),
  number: () => chain(),
  boolean: () => chain(),
  enum: (_values: readonly string[]) => chain(),
};
