import { ApiError } from '../../common/http/api-error';
import { matchesMagic, MediaService } from './media.service';
import { MediaRepository } from './media.repository';
import { ObjectStorage } from '../../infrastructure/storage/object-storage';
import { ConfigService } from '@nestjs/config';
import type { Actor } from '../../common/auth/security';
import { Types } from 'mongoose';
describe('upload verification', () => {
  it('detects PNG signature', () =>
    expect(
      matchesMagic(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'),
    ).toBe(true));
  it('rejects extension/MIME spoofing', () =>
    expect(
      matchesMagic(Buffer.from('<script>alert(1)</script>'), 'image/png'),
    ).toBe(false));
  it('rejects truncated JPEG signature', () =>
    expect(matchesMagic(Buffer.from([255, 216]), 'image/jpeg')).toBe(false));
  const actor: Actor = {
    id: new Types.ObjectId().toString(),
    role: 'writer',
    name: 'Writer',
    email: 'writer@example.com',
    sessionId: new Types.ObjectId().toString(),
  };
  const repo = { find: jest.fn(), complete: jest.fn() };
  const storage = {
    stat: jest.fn(),
    read: jest.fn(),
    put: jest.fn(),
    downloadUrl: jest.fn(),
  };
  const service = new MediaService(
    repo as unknown as MediaRepository,
    storage as unknown as ObjectStorage,
    {} as ConfigService,
  );
  beforeEach(() => jest.clearAllMocks());
  it('keeps articles readable when thumbnail signing is unavailable', async () => {
    repo.find.mockResolvedValue({
      id: 'image',
      objectKey: 'image-key',
      status: 'complete',
      mimeType: 'image/png',
    });
    storage.downloadUrl.mockRejectedValue(
      new ApiError(503, 'STORAGE_UNAVAILABLE', 'Unavailable'),
    );
    await expect(service.publicImage('image')).resolves.toBeNull();
  });
  it('checks ownership before accessing storage', async () => {
    repo.find.mockResolvedValue({ ownerId: new Types.ObjectId() });
    await expect(service.complete('id', actor)).rejects.toThrow(
      'another writer',
    );
    expect(storage.stat).not.toHaveBeenCalled();
  });
  it('rejects files whose actual size differs from intent', async () => {
    repo.find.mockResolvedValue({
      ownerId: new Types.ObjectId(actor.id),
      status: 'pending',
      expiresAt: new Date(Date.now() + 60000),
      size: 100,
      mimeType: 'image/png',
    });
    storage.stat.mockResolvedValue({ size: 101, mimeType: 'image/png' });
    await expect(service.complete('id', actor)).rejects.toThrow(
      'does not match',
    );
    expect(storage.put).not.toHaveBeenCalled();
  });
});
