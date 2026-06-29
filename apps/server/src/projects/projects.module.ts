import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { SchemaModule } from '../schema/schema.module.js';
import { ProjectsRepository } from './projects.repository.js';
import { ProjectsService } from './projects.service.js';

@Module({
  // SchemaModule is imported so the Project table is ensured before requests are
  // served (its SchemaService runs DDL at startup).
  imports: [DatabaseModule, SchemaModule],
  providers: [ProjectsService, ProjectsRepository],
  exports: [ProjectsService],
})
export class ProjectsModule {}
