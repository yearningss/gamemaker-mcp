export class GameMakerConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameMakerConnectionError";
  }
}

export class GameMakerCommandError extends Error {
  public code: number;
  public data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "GameMakerCommandError";
    this.code = code;
    this.data = data;
  }
}

export class GameMakerTimeoutError extends Error {
  constructor(method: string, timeout: number) {
    super(`Command '${method}' timed out after ${timeout}ms`);
    this.name = "GameMakerTimeoutError";
  }
}

export function formatError(error: unknown): string {
  if (error instanceof GameMakerConnectionError) {
    return `Connection error: ${error.message}. Make sure GameMaker is running with the MCP extension enabled.`;
  }
  if (error instanceof GameMakerCommandError) {
    return `GameMaker error (${error.code}): ${error.message}`;
  }
  if (error instanceof GameMakerTimeoutError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
