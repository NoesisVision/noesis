import { Module } from '@nestjs/common';
import { loadConfig } from './config';
import { MCP_CONFIG, ServerClientService } from './server-client.service';

@Module({
  providers: [
    { provide: MCP_CONFIG, useFactory: loadConfig },
    ServerClientService,
  ],
  exports: [ServerClientService],
})
export class McpModule {}
