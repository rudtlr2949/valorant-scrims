import { gatewayIntents } from './config.mjs';

const permittedGateway = value => {
  const url = new URL(value);
  if (url.protocol !== 'wss:' || !(url.hostname === 'gateway.discord.gg' || url.hostname.endsWith('.discord.gg'))) {
    throw new Error('Unexpected Discord Gateway host');
  }
  url.searchParams.set('v', '10'); url.searchParams.set('encoding', 'json');
  return url.toString();
};

export class RegistryGateway {
  constructor(token, { socketFactory = url => new WebSocket(url), session = null,
    onDispatch = async () => {}, onError = () => {}, onConnection = () => {} } = {}) {
    this.token = token; this.socketFactory = socketFactory; this.session = session;
    this.onDispatch = onDispatch; this.onError = onError; this.onConnection = onConnection;
    this.connected = false; this.stopped = false; this.acknowledged = true; this.backoff = 1000;
    this.dispatchChain = Promise.resolve();
    this.epoch = 0; this.sequence = session?.sequence ?? null;
  }
  connect(url = this.session?.url || 'wss://gateway.discord.gg') {
    if (this.stopped) return;
    clearTimeout(this.reconnectTimer); clearTimeout(this.heartbeatTimer);
    this.connected = false; this.acknowledged = true;
    this.epoch++; this.dispatchFailed = false;
    const socket = this.socketFactory(permittedGateway(url));
    this.socket = socket;
    socket.addEventListener('message', event => {
      if (socket !== this.socket) return;
      try { this.handlePacket(JSON.parse(String(event.data))); }
      catch (error) { this.onError(error); socket.close(4000, 'Invalid gateway packet'); }
    });
    socket.addEventListener('error', () => this.onError(new Error('Discord Gateway connection error')));
    socket.addEventListener('close', event => {
      if (socket !== this.socket) return;
      clearTimeout(this.heartbeatTimer); this.connected = false; this.onConnection(false);
      if ([4004, 4010, 4011, 4012, 4013, 4014].includes(event.code)) {
        this.stopped = true;
        this.onError(new Error(`Discord Gateway configuration error ${event.code}`));
        return;
      }
      if ([4007, 4009].includes(event.code)) this.session = null;
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.backoff + Math.random() * 1000);
        this.backoff = Math.min(60000, this.backoff * 2);
      }
    });
  }
  send(op, d) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify({ op, d }));
  }
  heartbeat(watchdog = false) {
    if (this.stopped) return;
    if (watchdog && !this.acknowledged) { this.socket?.close(4000, 'Heartbeat acknowledgement missing'); return; }
    this.acknowledged = false; this.send(1, this.sequence);
    if (watchdog) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = setTimeout(() => this.heartbeat(true), this.heartbeatInterval);
    }
  }
  handlePacket(packet) {
    if (packet.s !== null && packet.s !== undefined) {
      this.sequence = packet.s;
    }
    if (packet.op === 10) {
      this.heartbeatInterval = packet.d.heartbeat_interval;
      this.acknowledged = true;
      this.heartbeatTimer = setTimeout(() => this.heartbeat(true), Math.random() * this.heartbeatInterval);
      if (this.session?.id && this.session.sequence !== undefined) {
        this.send(6, { token: this.token, session_id: this.session.id, seq: this.session.sequence });
      } else {
        this.send(2, { token: this.token, intents: gatewayIntents,
          properties: { os: 'linux', browser: 'kov-registry', device: 'kov-registry' } });
      }
      return;
    }
    if (packet.op === 11) { this.acknowledged = true; return; }
    if (packet.op === 1) { this.heartbeat(); return; }
    if (packet.op === 7) { this.socket?.close(4000, 'Gateway requested reconnect'); return; }
    if (packet.op === 9) {
      if (!packet.d) this.session = null;
      clearTimeout(this.heartbeatTimer);
      // Discord requires a random 1–5 second delay after Invalid Session.
      const socket = this.socket;
      setTimeout(() => { if (socket === this.socket) socket?.close(4000, 'Invalid session'); }, 1000 + Math.random() * 4000);
      return;
    }
    if (packet.op !== 0) return;
    if (packet.t === 'READY') {
      permittedGateway(packet.d.resume_gateway_url);
      this.session = { id: packet.d.session_id, url: packet.d.resume_gateway_url, sequence: packet.s };
      this.connected = true; this.backoff = 1000; this.onConnection(true);
    }
    if (packet.t === 'RESUMED') { this.connected = true; this.backoff = 1000; this.onConnection(true); }
    const epoch = this.epoch;
    this.dispatchChain = this.dispatchChain.then(async () => {
      if (this.dispatchFailed || epoch !== this.epoch || this.stopped) return;
      await this.onDispatch(packet.t, packet.d);
      // Only checkpoint events after their work has been durably enqueued.
      if (this.session && epoch === this.epoch) this.session.sequence = packet.s;
    }).catch(error => {
      if (epoch !== this.epoch) return;
      this.dispatchFailed = true; this.onError(error);
      this.socket?.close(4000, 'Event persistence failed');
    });
  }
  async stop() {
    this.stopped = true; this.connected = false;
    clearTimeout(this.heartbeatTimer); clearTimeout(this.reconnectTimer);
    this.socket?.close(4000, 'Worker shutdown');
    await this.dispatchChain;
  }
}
