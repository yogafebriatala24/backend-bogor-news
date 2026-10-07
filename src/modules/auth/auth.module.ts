import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { SessionSchema } from './session.schema';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { RateLimitGuard } from '../../common/auth/rate-limit.guard';
@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: 'Session', schema: SessionSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: 900,
          algorithm: 'HS256',
          issuer: 'backend-news',
          audience: 'backend-news-api',
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: 'backend-news',
          audience: 'backend-news-api',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
