import { ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../common/swagger/api-endpoint';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, Public } from '../../common/auth/security';
import type { Actor } from '../../common/auth/security';
import { LoginDto, RefreshDto } from './auth.dto';
import { AuthService } from './auth.service';
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @ApiEndpoint('Login dan buat session', 'Tokens', {
    public: true,
    unauthorized: true,
  })
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
  @ApiEndpoint('Rotasi refresh token', 'Tokens', {
    public: true,
    unauthorized: true,
    description:
      'Refresh token sekali pakai; session berlaku 7 hari sejak login.',
  })
  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
  @ApiEndpoint('Cabut session saat ini', 'Message', {})
  @Post('logout')
  @HttpCode(200)
  logout(@CurrentUser() actor: Actor) {
    return this.auth.logout(actor.sessionId);
  }
  @ApiEndpoint('Profil user saat ini', 'CurrentUser', {})
  @Get('me')
  me(@CurrentUser() actor: Actor) {
    return {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
    };
  }
}
