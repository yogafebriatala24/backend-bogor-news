import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { MediaModule } from './modules/media/media.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { HealthModule } from './modules/health/health.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    CacheModule,
    AuthModule,
    UsersModule,
    TaxonomyModule,
    MediaModule,
    ArticlesModule,
    HealthModule,
  ],
})
export class AppModule {}
