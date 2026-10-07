import { Logger, ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupHttp } from './common/http/setup';
import { setupSwagger } from './common/swagger/setup-swagger';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  setupHttp(app);
  setupSwagger(app);
  await app.listen(
    app.get(ConfigService).getOrThrow<number>('PORT'),
    app.get(ConfigService).getOrThrow<string>('APP_HOST'),
  );
}
void bootstrap().catch(() => {
  new Logger('Bootstrap').error(
    'Application failed to start; check configuration and dependency availability',
  );
  process.exitCode = 1;
});
