import { assertTransition, ArticlesService } from './articles.service';
import { ArticlesRepository } from './articles.repository';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { MediaService } from '../media/media.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import type { Actor } from '../../common/auth/security';
import { Types } from 'mongoose';
describe('editorial workflow', () => {
  it('allows writer to submit an owned draft', () =>
    expect(() =>
      assertTransition('draft', 'review', 'writer', true),
    ).not.toThrow());
  it('forbids writer publishing', () =>
    expect(() =>
      assertTransition('review', 'published', 'writer', true),
    ).toThrow());
  it('forbids writer submitting another author’s draft', () =>
    expect(() =>
      assertTransition('draft', 'review', 'writer', false),
    ).toThrow());
  it('requires review before publish', () =>
    expect(() =>
      assertTransition('draft', 'published', 'editor', false),
    ).toThrow());
  it('allows editor to publish reviewed content', () =>
    expect(() =>
      assertTransition('review', 'published', 'editor', false),
    ).not.toThrow());
  it('allows review rejection back to draft', () =>
    expect(() =>
      assertTransition('review', 'draft', 'editor', false),
    ).not.toThrow());
  it('does not reopen archived articles implicitly', () =>
    expect(() =>
      assertTransition('archived', 'published', 'admin', false),
    ).toThrow());
});
describe('article data protections', () => {
  const actor: Actor = {
    id: new Types.ObjectId().toString(),
    role: 'writer',
    name: 'Writer',
    email: 'writer@example.com',
    sessionId: new Types.ObjectId().toString(),
  };
  const repo = { visible: jest.fn(), find: jest.fn(), update: jest.fn() };
  const cache = { get: jest.fn(), delete: jest.fn() };
  const service = new ArticlesService(
    repo as unknown as ArticlesRepository,
    {} as TaxonomyService,
    {} as MediaService,
    cache as unknown as CacheService,
  );
  beforeEach(() => jest.clearAllMocks());
  it('never reads cached article when visibility check fails', async () => {
    repo.visible.mockResolvedValue(null);
    await expect(service.publicDetail('archived')).rejects.toThrow(
      'Article not found',
    );
    expect(cache.get).not.toHaveBeenCalled();
  });
  it('rejects editing another writer’s article', async () => {
    repo.find.mockResolvedValue({ authorId: new Types.ObjectId() });
    await expect(
      service.update('id', { revision: 1, title: 'Changed title' }, actor),
    ).rejects.toThrow('another writer');
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('rejects edits of reviewed articles by their author', async () => {
    repo.find.mockResolvedValue({
      authorId: new Types.ObjectId(actor.id),
      status: 'review',
      revision: 1,
    });
    await expect(service.update('id', { revision: 1 }, actor)).rejects.toThrow(
      'own drafts',
    );
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('rejects stale editor revisions', async () => {
    repo.find.mockResolvedValue({
      authorId: new Types.ObjectId(actor.id),
      status: 'draft',
      revision: 2,
    });
    await expect(
      service.update('id', { revision: 1 }, { ...actor, role: 'editor' }),
    ).rejects.toThrow('reload');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
