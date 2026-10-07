import { Types } from 'mongoose';
import { encodeCursor, decodeCursor } from './cursor';
describe('article cursor', () => {
  it('round trips date and unique tie-breaker', () => {
    const date = new Date('2026-10-03T00:00:00Z');
    const id = new Types.ObjectId();
    expect(decodeCursor(encodeCursor(date, id))).toEqual({ date, id });
  });
  it.each([
    'not-base64',
    Buffer.from('{}').toString('base64url'),
    Buffer.from(JSON.stringify({ date: 'invalid', id: 'abc' })).toString(
      'base64url',
    ),
  ])('rejects malformed cursor %s', (cursor) =>
    expect(() => decodeCursor(cursor)).toThrow('Invalid pagination cursor'),
  );
});
