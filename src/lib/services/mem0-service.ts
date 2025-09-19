import MemoryClient from 'mem0ai';
import { LogCategory, logger } from 'agentdock-core';

import { getEnvConfig } from '@/types/env';

let client: MemoryClient | null = null;

/**
 * Lazily instantiate and return a shared Mem0 client.
 * Pulls configuration from validated environment variables so local setups
 * (like a developer laptop) can rely on .env without hardcoding secrets.
 */
export function getMem0Client(): MemoryClient {
  if (client) {
    return client;
  }

  const { MEM0_API_KEY } = getEnvConfig();

  if (!MEM0_API_KEY) {
    const message = 'MEM0_API_KEY is required to initialize the Mem0 client.';
    void logger.warn(LogCategory.STORAGE, 'Mem0Service', message);
    throw new Error(message);
  }

  client = new MemoryClient({ apiKey: MEM0_API_KEY });
  void logger.debug(LogCategory.STORAGE, 'Mem0Service', 'Mem0 client initialized');

  return client;
}

/**
 * Reset the singleton client. Primarily useful for tests so they can
 * reconfigure the instance between scenarios.
 */
export function resetMem0Client(): void {
  client = null;
}
