import { Global, Logger, Module } from '@nestjs/common';
import { z } from 'zod';

// Injection token for the on-disk LadybugDB data directory.
export const DATA_DIR = 'DATA_DIR';

// Server configuration is read from the environment and zod-validated at
// bootstrap, failing fast on garbage (decision 10's pattern). The server keeps
// exactly ONE data dir for its on-disk DB; projects are scoped inside the DB by
// `project_id` (OQ-2.2), not by per-project directories — so the SDLC
// `PROJECT_DIR` is gone.
const envSchema = z.object({
  NOESIS_DATA_DIR: z.string().min(1).default('.data'),
});

export interface ServerConfig {
  dataDir: string;
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    new Logger('ConfigModule').error(
      `Invalid server configuration:\n${z.prettifyError(parsed.error)}`,
    );
    process.exit(1);
  }
  return { dataDir: parsed.data.NOESIS_DATA_DIR };
}

@Global()
@Module({
  providers: [
    { provide: DATA_DIR, useFactory: (): string => loadServerConfig().dataDir },
  ],
  exports: [DATA_DIR],
})
export class ConfigModule {}
