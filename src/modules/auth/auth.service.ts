import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Session } from './session.schema';
import { UsersRepository } from '../users/users.repository';
import { ApiError } from '../../common/http/api-error';
@Injectable()
export class AuthService {
  private dummyHash = argon2.hash(randomBytes(32).toString('hex'), {
    type: argon2.argon2id,
  });
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    @InjectModel('Session') private readonly sessions: Model<Session>,
  ) {}
  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    const valid = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!user?.active || !valid)
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    const id = new Types.ObjectId();
    const refreshToken = `${id.toString()}.${randomBytes(32).toString('hex')}`;
    await this.sessions.create({
      _id: id,
      userId: user._id,
      refreshHash: this.hash(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    return this.tokens(user.id, id.toString(), refreshToken);
  }
  async refresh(token: string) {
    const id = token.split('.')[0];
    if (!/^[a-f0-9]{24}\.[a-f0-9]{64}$/.test(token))
      throw new ApiError(
        401,
        'INVALID_REFRESH_TOKEN',
        'Invalid or expired refresh token',
      );
    const replacement = `${id}.${randomBytes(32).toString('hex')}`;
    const session = await this.sessions
      .findOneAndUpdate(
        {
          _id: id,
          refreshHash: this.hash(token),
          expiresAt: { $gt: new Date() },
        },
        { $set: { refreshHash: this.hash(replacement) } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!session)
      throw new ApiError(
        401,
        'INVALID_REFRESH_TOKEN',
        'Invalid or expired refresh token',
      );
    const user = await this.users.findById(session.userId.toString());
    if (!user?.active) {
      await this.sessions.deleteOne({ _id: id });
      throw new ApiError(401, 'ACCOUNT_INACTIVE', 'Account is unavailable');
    }
    return this.tokens(user.id, id, replacement);
  }
  async logout(sessionId: string) {
    await this.sessions.deleteOne({ _id: sessionId });
    return { message: 'Logged out' };
  }
  async authenticate(token: string) {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token);
    } catch {
      throw new ApiError(
        401,
        'INVALID_ACCESS_TOKEN',
        'Invalid or expired access token',
      );
    }
    if (
      !/^[a-f0-9]{24}$/.test(payload.sub ?? '') ||
      !/^[a-f0-9]{24}$/.test(payload.sid ?? '')
    )
      throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Invalid access token');
    const [user, session] = await Promise.all([
      this.users.findById(payload.sub),
      this.sessions.exists({
        _id: payload.sid,
        userId: payload.sub,
        expiresAt: { $gt: new Date() },
      }),
    ]);
    if (!user?.active || !session)
      throw new ApiError(401, 'SESSION_EXPIRED', 'Session is no longer active');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sessionId: payload.sid,
    };
  }
  private async tokens(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ) {
    return {
      accessToken: await this.jwt.signAsync({ sub: userId, sid: sessionId }),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
