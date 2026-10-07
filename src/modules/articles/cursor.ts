import { Types } from 'mongoose';
import { ApiError } from '../../common/http/api-error';
export function encodeCursor(date: Date, id: unknown) {
  return Buffer.from(
    JSON.stringify({ date: date.toISOString(), id: String(id) }),
  ).toString('base64url');
}
export function decodeCursor(cursor: string) {
  try {
    const data: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (!data || typeof data !== 'object') throw new Error();
    const { date, id } = data as { date: unknown; id: unknown };
    if (
      typeof date !== 'string' ||
      typeof id !== 'string' ||
      !Number.isFinite(Date.parse(date)) ||
      !/^[a-f0-9]{24}$/.test(id)
    )
      throw new Error();
    return { date: new Date(date), id: new Types.ObjectId(id) };
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
  }
}
