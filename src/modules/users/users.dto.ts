import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ROLES } from '../../common/auth/security';
import type { Role } from '../../common/auth/security';
export class CreateUserDto {
  @ApiProperty({
    type: String,
    minLength: 2,
    maxLength: 120,
    example: 'Berita Nasional',
  })
  @IsString()
  @Length(2, 120)
  name!: string;
  @ApiProperty({
    type: String,
    maxLength: 254,
    format: 'email',
    example: 'admin@db-news.local',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({
    type: String,
    minLength: 12,
    maxLength: 128,
    example: 'contoh-password-aman',
    writeOnly: true,
  })
  @IsString()
  @Length(12, 128)
  password!: string;
  @ApiProperty({ enum: ROLES, example: 'writer' })
  @IsIn(ROLES)
  role!: Role;
}
export class UpdateUserDto {
  @ApiPropertyOptional({
    type: String,
    minLength: 2,
    maxLength: 120,
    example: 'Berita Nasional',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(2, 120)
  name?: string;
  @ApiPropertyOptional({ enum: ROLES, example: 'writer' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(ROLES)
  role?: Role;
  @ApiPropertyOptional({ type: Boolean, example: true })
  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  active?: boolean;
}
