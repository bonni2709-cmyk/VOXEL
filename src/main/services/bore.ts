/**
 * Клиент протокола bore (ekzhang/bore) для публикации сервера через bore.pub.
 * Кадры: 4 байта длины (big-endian) + JSON. Enum в JSON: {"Hello":port}, {"Connection":id}, {"Accept":id}.
 */
import { connect, type Socket } from 'node:net';

export const BORE_SERVER = 'bore.pub';
export const BORE_CONTROL_PORT = 7835;

export type BoreMessage = { Hello: number } | { Connection: string } | { Accept: string } | { Challenge: string };

export function encodeFrame(msg: BoreMessage): Buffer {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length, 0);
  return Buffer.concat([head, body]);
}

/** Потоковый декодер кадров: принимает куски любого размера. */
export class FrameDecoder {
  private buf = Buffer.alloc(0);

  push(chunk: Buffer): BoreMessage[] {
    this.buf = Buffer.concat([this.buf, chunk]);
    const out: BoreMessage[] = [];
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32BE(0);
      if (len > 64 * 1024) throw new Error('Слишком большой кадр bore');
      if (this.buf.length < 4 + len) break;
      const body = this.buf.subarray(4, 4 + len).toString('utf8');
      this.buf = this.buf.subarray(4 + len);
      out.push(JSON.parse(body) as BoreMessage);
    }
    return out;
  }
}

export interface BoreTunnel {
  publicAddress: string;
  close: () => void;
}

/** Открывает туннель: локальный порт → bore.pub:<удалённый порт>. */
export function openBoreTunnel(localPort: number, opts: { server?: string; controlPort?: number; remotePort?: number } = {}): Promise<BoreTunnel> {
  const server = opts.server ?? BORE_SERVER;
  const controlPort = opts.controlPort ?? BORE_CONTROL_PORT;
  return new Promise((resolve, reject) => {
    const control = connect(controlPort, server);
    const decoder = new FrameDecoder();
    const sockets = new Set<Socket>([control]);
    let settled = false;

    const fail = (err: Error) => {
      if (!settled) { settled = true; reject(err); }
      for (const s of sockets) s.destroy();
    };

    control.setTimeout(15_000, () => fail(new Error('bore.pub не отвечает')));
    control.on('error', fail);
    control.on('connect', () => control.write(encodeFrame({ Hello: opts.remotePort ?? 0 })));

    control.on('data', (chunk: Buffer) => {
      let msgs: BoreMessage[];
      try {
        msgs = decoder.push(chunk);
      } catch (e) {
        return fail(e as Error);
      }
      for (const msg of msgs) {
        if ('Hello' in msg) {
          if (settled) continue;
          settled = true;
          control.setTimeout(0);
          resolve({
            publicAddress: `${server}:${msg.Hello}`,
            close: () => { for (const s of sockets) s.destroy(); },
          });
        } else if ('Connection' in msg) {
          const id = msg.Connection;
          const remote = connect(controlPort, server);
          sockets.add(remote);
          const local = connect(localPort, '127.0.0.1');
          sockets.add(local);
          remote.on('connect', () => remote.write(encodeFrame({ Accept: id })));
          remote.pipe(local);
          local.pipe(remote);
          const drop = () => { remote.destroy(); local.destroy(); sockets.delete(remote); sockets.delete(local); };
          remote.on('error', drop);
          local.on('error', drop);
          remote.on('close', drop);
          local.on('close', drop);
        }
      }
    });
    control.on('close', () => {
      if (!settled) fail(new Error('Соединение с bore.pub закрыто'));
    });
  });
}
