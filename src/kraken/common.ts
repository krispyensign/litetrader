export const isError = (err: unknown): err is Error =>
  typeof err === 'object' &&
  (err as Error).message !== undefined &&
  (err as Error).stack !== undefined
