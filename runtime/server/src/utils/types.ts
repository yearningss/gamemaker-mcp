export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface GameMakerInstance {
  id: number;
  object_index: number;
  object_name: string;
  x: number;
  y: number;
  sprite_index: number;
  visible: boolean;
  depth: number;
  layer: string;
}

export interface RoomInfo {
  name: string;
  index: number;
  width: number;
  height: number;
  creation_code: string;
  instance_count: number;
}

export interface PerformanceStats {
  fps: number;
  fps_real: number;
  instance_count: number;
  memory_usage: number;
  step_time: number;
  draw_time: number;
}

export interface ConnectionOptions {
  host: string;
  port: number;
  reconnectInterval: number;
  heartbeatInterval: number;
  commandTimeout: number;
}

export const DEFAULT_CONNECTION_OPTIONS: ConnectionOptions = {
  host: "127.0.0.1",
  port: 6705,
  reconnectInterval: 3000,
  heartbeatInterval: 10000,
  commandTimeout: 30000,
};
