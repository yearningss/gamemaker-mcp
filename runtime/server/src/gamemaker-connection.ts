import * as net from "net";
import { EventEmitter } from "events";
import {
  JsonRpcRequest,
  JsonRpcResponse,
  ConnectionOptions,
  DEFAULT_CONNECTION_OPTIONS,
} from "./utils/types.js";
import {
  GameMakerConnectionError,
  GameMakerCommandError,
  GameMakerTimeoutError,
} from "./utils/errors.js";

export class GameMakerConnection extends EventEmitter {
  private socket: net.Socket | null = null;
  private options: ConnectionOptions;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private receiveBuffer = "";
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: Partial<ConnectionOptions>) {
    super();
    this.options = { ...DEFAULT_CONNECTION_OPTIONS, ...options };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }

      this.socket = new net.Socket();

      this.socket.on("connect", () => {
        this.connected = true;
        this.receiveBuffer = "";
        this.startHeartbeat();
        this.emit("connected");
        resolve();
      });

      this.socket.on("data", (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.on("close", () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.stopHeartbeat();
        this.rejectAllPending("Connection closed");
        this.emit("disconnected");
        if (wasConnected) {
          this.scheduleReconnect();
        }
      });

      this.socket.on("error", (err: Error) => {
        if (!this.connected) {
          reject(new GameMakerConnectionError(err.message));
        }
        this.emit("error", err);
      });

      this.socket.connect(this.options.port, this.options.host);
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending("Disconnecting");
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.connected || !this.socket) {
      try {
        await this.connect();
      } catch {
        throw new GameMakerConnectionError(
          "Not connected to GameMaker. Ensure the game is running with MCP extension enabled."
        );
      }
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: params || {},
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new GameMakerTimeoutError(method, this.options.commandTimeout));
      }, this.options.commandTimeout);

      this.pending.set(id, { resolve, reject, timer });

      const message = JSON.stringify(request) + "\n";
      this.socket!.write(message);
    });
  }

  private handleData(data: Buffer): void {
    // Strip null bytes from GM's buffer_text output
    this.receiveBuffer += data.toString("utf-8").replace(/\0/g, "");

    let newlineIndex: number;
    while ((newlineIndex = this.receiveBuffer.indexOf("\n")) !== -1) {
      const line = this.receiveBuffer.substring(0, newlineIndex).trim();
      this.receiveBuffer = this.receiveBuffer.substring(newlineIndex + 1);

      if (line.length === 0) continue;

      try {
        const response: JsonRpcResponse = JSON.parse(line);
        this.handleResponse(response);
      } catch {
        this.emit("error", new Error(`Invalid JSON response: ${line}`));
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(response.id);

    if (response.error) {
      pending.reject(
        new GameMakerCommandError(
          response.error.code,
          response.error.message,
          response.error.data
        )
      );
    } else {
      pending.resolve(response.result);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.sendCommand("ping");
      } catch {
        // Connection may be lost, handled by socket events
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect();
      }
    }, this.options.reconnectInterval);
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new GameMakerConnectionError(reason));
    }
    this.pending.clear();
  }
}
