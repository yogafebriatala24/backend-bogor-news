import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import type { Session } from './session.schema';
describe('session protection', () => {
  const users = { findById: jest.fn() };
  const jwt = { verifyAsync: jest.fn(), signAsync: jest.fn() };
  const sessions = { findOneAndUpdate: jest.fn(), exists: jest.fn() };
  const service = new AuthService(
    users as unknown as UsersRepository,
    jwt as unknown as JwtService,
    sessions as unknown as Model<Session>,
  );
  beforeEach(() => jest.clearAllMocks());
  it('rejects malformed refresh tokens before database access', async () => {
    await expect(service.refresh('invalid')).rejects.toThrow(
      'Invalid or expired',
    );
    expect(sessions.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects refresh tokens that have been consumed', async () => {
    sessions.findOneAndUpdate.mockReturnValue({
      exec: () => Promise.resolve(null),
    });
    await expect(
      service.refresh(`${new Types.ObjectId().toString()}.${'a'.repeat(64)}`),
    ).rejects.toThrow('Invalid or expired');
  });
  it('rejects a valid JWT after session revocation', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: new Types.ObjectId().toString(),
      sid: new Types.ObjectId().toString(),
    });
    users.findById.mockResolvedValue({ active: true });
    sessions.exists.mockResolvedValue(null);
    await expect(service.authenticate('token')).rejects.toThrow(
      'no longer active',
    );
  });
  it('rejects inactive users immediately', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: new Types.ObjectId().toString(),
      sid: new Types.ObjectId().toString(),
    });
    users.findById.mockResolvedValue({ active: false });
    sessions.exists.mockResolvedValue({ _id: 'session' });
    await expect(service.authenticate('token')).rejects.toThrow(
      'no longer active',
    );
  });
});
