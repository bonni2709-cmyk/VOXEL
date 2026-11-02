/** Discord Rich Presence. Без Application ID или без запущенного Discord — тихо ничего не делает. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DiscordRPC = require('discord-rpc') as {
  Client: new (opts: { transport: 'ipc' }) => {
    login: (o: { clientId: string }) => Promise<unknown>;
    setActivity: (a: Record<string, unknown>) => Promise<unknown>;
    clearActivity: () => Promise<unknown>;
    destroy: () => Promise<unknown>;
    on: (ev: string, cb: () => void) => void;
  };
};

let client: InstanceType<typeof DiscordRPC.Client> | null = null;
let clientId = '';
let startedAt = 0;

export async function connectDiscord(appId: string): Promise<boolean> {
  if (!appId || !/^\d{15,25}$/.test(appId)) return false;
  if (client && clientId === appId) return true;
  await disconnectDiscord();
  try {
    const c = new DiscordRPC.Client({ transport: 'ipc' });
    c.on('disconnected', () => { client = null; });
    await c.login({ clientId: appId });
    client = c;
    clientId = appId;
    return true;
  } catch {
    client = null;
    return false;
  }
}

export async function setPlaying(details: string, state: string): Promise<void> {
  if (!client) return;
  startedAt = startedAt || Date.now();
  await client.setActivity({ details, state, startTimestamp: startedAt, largeImageKey: 'voxel', largeImageText: 'VOXEL 5.0' })
    .catch(() => undefined);
}

export async function clearPlaying(): Promise<void> {
  startedAt = 0;
  if (!client) return;
  await client.clearActivity().catch(() => undefined);
}

export async function disconnectDiscord(): Promise<void> {
  if (client) await client.destroy().catch(() => undefined);
  client = null;
  clientId = '';
}
