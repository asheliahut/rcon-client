"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rcon = void 0;
const net_1 = require("net");
const packet_1 = require("./packet");
const splitter_1 = require("./splitter");
const queue_1 = require("./queue");
const events_1 = require("events");
const defaultOptions = {
    port: 25575,
    timeout: 2000,
    maxPending: 1
};
class Rcon {
    static async connect(config) {
        const rcon = new Rcon(config);
        await rcon.connect();
        return rcon;
    }
    sendQueue;
    callbacks = new Map();
    requestId = 0;
    config;
    emitter = new events_1.EventEmitter();
    socket = null;
    authenticated = false;
    on = this.emitter.on.bind(this.emitter);
    once = this.emitter.once.bind(this.emitter);
    off = this.emitter.removeListener.bind(this.emitter);
    constructor(config) {
        this.config = { ...defaultOptions, ...config };
        this.sendQueue = new queue_1.PromiseQueue(this.config.maxPending);
        if (config.maxPending)
            this.emitter.setMaxListeners(config.maxPending);
    }
    async connect() {
        if (this.socket) {
            throw new Error("Already connected or connecting");
        }
        const socket = this.socket = (0, net_1.connect)({
            host: this.config.host,
            port: this.config.port
        });
        try {
            await new Promise((resolve, reject) => {
                socket.once("error", reject);
                socket.on("connect", () => {
                    socket.off("error", reject);
                    resolve();
                });
            });
        }
        catch (error) {
            this.socket = null;
            throw error;
        }
        socket.setNoDelay(true);
        socket.on("error", error => this.emitter.emit("error", error));
        this.emitter.emit("connect");
        this.socket.on("close", () => {
            this.emitter.emit("end");
            this.sendQueue.pause();
            this.socket = null;
            this.authenticated = false;
        });
        this.socket
            .pipe((0, splitter_1.createSplitter)())
            .on("data", this.handlePacket.bind(this));
        const id = this.requestId;
        const packet = await this.sendPacket(packet_1.PacketType.Auth, Buffer.from(this.config.password));
        this.sendQueue.resume();
        if (packet.id != id || packet.id == -1) {
            this.sendQueue.pause();
            this.socket.destroy();
            this.socket = null;
            throw new Error("Authentication failed");
        }
        this.authenticated = true;
        this.emitter.emit("authenticated");
        return this;
    }
    /**
      Close the connection to the server.
    */
    async end() {
        if (!this.socket || this.socket.connecting) {
            throw new Error("Not connected");
        }
        if (!this.socket.writable)
            throw new Error("End called twice");
        this.sendQueue.pause();
        this.socket.end();
        await new Promise(resolve => this.on("end", resolve));
    }
    /**
      Send a command to the server.

      @param command The command that will be executed on the server.
      @returns A promise that will be resolved with the command's response from the server.
    */
    async send(command) {
        const payload = await this.sendRaw(Buffer.from(command, "ascii"));
        return payload.toString("ascii");
    }
    async sendRaw(buffer) {
        if (!this.authenticated || !this.socket)
            throw new Error("Not connected");
        const packet = await this.sendPacket(packet_1.PacketType.Command, buffer);
        return packet.payload;
    }
    async sendPacket(type, payload) {
        const id = this.requestId++;
        const createSendPromise = () => {
            this.socket.write((0, packet_1.encodePacket)({ id, type, payload }));
            return new Promise((resolve, reject) => {
                const onEnd = () => (reject(new Error("Connection closed")), clearTimeout(timeout));
                this.emitter.on("end", onEnd);
                const timeout = setTimeout(() => {
                    this.off("end", onEnd);
                    reject(new Error(`Timeout for packet id ${id}`));
                }, this.config.timeout);
                this.callbacks.set(id, packet => {
                    this.off("end", onEnd);
                    clearTimeout(timeout);
                    resolve(packet);
                });
            });
        };
        if (type == packet_1.PacketType.Auth) {
            return createSendPromise();
        }
        else {
            return await this.sendQueue.add(createSendPromise);
        }
    }
    handlePacket(data) {
        const packet = (0, packet_1.decodePacket)(data);
        const id = this.authenticated ? packet.id : this.requestId - 1;
        const handler = this.callbacks.get(id);
        if (handler) {
            handler(packet);
            this.callbacks.delete(id);
        }
    }
}
exports.Rcon = Rcon;
