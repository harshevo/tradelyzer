export function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return fallback;
}
