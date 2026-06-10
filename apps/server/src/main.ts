import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // No global prefix — each route surface (/ui, /api, /internal) carries its
  // own prefix via the route constants in the contracts packages.
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
