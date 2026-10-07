import { Injectable, PipeTransform } from '@nestjs/common';
import { ApiError } from './api-error';
@Injectable()
export class ObjectIdPipe implements PipeTransform<string> {
  transform(value: string) {
    if (!/^[a-f0-9]{24}$/i.test(value))
      throw new ApiError(400, 'INVALID_ID', 'Invalid resource ID');
    return value;
  }
}
