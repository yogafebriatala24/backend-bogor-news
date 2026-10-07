import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
export class UploadIntentDto {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 180,
    example: 'foto.png',
  })
  @IsString()
  @Length(1, 180)
  filename!: string;
  @ApiProperty({
    enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    example: 'image/png',
  })
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  mimeType!: string;
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 104857600,
    example: 12345,
    description:
      'Ukuran file dalam byte; juga dibatasi MAX_UPLOAD_BYTES (default 10 MiB).',
  })
  @IsInt()
  @Min(1)
  @Max(104857600)
  size!: number;
}
export class CompleteUploadDto {
  @ApiProperty({
    type: String,
    pattern: '^[a-fA-F0-9]{24}$',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  mediaId!: string;
}
