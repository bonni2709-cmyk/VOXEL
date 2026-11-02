import { safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/** Секреты (ключи API, Discord App ID) шифруются через OS keychain и лежат в data-каталоге. */
export type SecretName = 'groqKey' | 'mistralKey' | 'discordAppId';
export const SECRET_NAMES: SecretName[] = ['groqKey', 'mistralKey', 'discordAppId'];

function file(root: string): string {
  return join(root, 'secrets.bin');
}

async function readAll(root: string): Promise<Partial<Record<SecretName, string>>> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return {};
    return JSON.parse(safeStorage.decryptString(await fs.readFile(file(root)))) as Partial<Record<SecretName, string>>;
  } catch {
    return {};
  }
}

export async function getSecret(root: string, name: SecretName): Promise<string | null> {
  return (await readAll(root))[name] ?? null;
}

export async function setSecret(root: string, name: SecretName, value: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Шифрование недоступно: секрет не сохранён');
  const all = await readAll(root);
  if (value) all[name] = value;
  else delete all[name];
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(file(root), safeStorage.encryptString(JSON.stringify(all)));
}

export async function hasSecret(root: string, name: SecretName): Promise<boolean> {
  return Boolean((await readAll(root))[name]);
}
