/// <reference types="node" />
/// <reference types="node" />
import { Socket } from "net";
import TypedEmitter, { EventMap } from "typed-emitter";
export interface RconOptions {
    host: string;
    /** @default 25575 */
    port?: number;
    password: string;
    /**
     * Maximum time for a packet to arrive before an error is thrown
     * @default 2000 ms
     */
    timeout?: number;
    /**
     * Maximum number of parallel requests. Most minecraft servers can
     * only reliably process one packet at a time.
     * @default 1
     */
    maxPending?: number;
}
export declare class Rcon {
    static connect(config: RconOptions): Promise<Rcon>;
    private sendQueue;
    private callbacks;
    private requestId;
    config: Required<RconOptions>;
    emitter: TypedEmitter<EventMap>;
    socket: Socket | null;
    authenticated: boolean;
    on: <E extends string | number>(event: E, listener: EventMap[E]) => TypedEmitter<EventMap>;
    once: <E extends string | number>(event: E, listener: EventMap[E]) => TypedEmitter<EventMap>;
    off: <E extends string | number>(event: E, listener: EventMap[E]) => TypedEmitter<EventMap>;
    constructor(config: RconOptions);
    connect(): Promise<this>;
    /**
      Close the connection to the server.
    */
    end(): Promise<void>;
    /**
      Send a command to the server.

      @param command The command that will be executed on the server.
      @returns A promise that will be resolved with the command's response from the server.
    */
    send(command: string): Promise<string>;
    sendRaw(buffer: Buffer): Promise<Buffer>;
    private sendPacket;
    private handlePacket;
}
