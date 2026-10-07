import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
export class CreateTaxonomyDto {
  @ApiProperty({
    type: String,
    minLength: 2,
    maxLength: 100,
    example: 'Berita Nasional',
  })
  @IsString()
  @Length(2, 100)
  name!: string;
  @ApiProperty({
    type: String,
    minLength: 2,
    maxLength: 140,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.source,
    example: 'berita-lokal-pertama',
  })
  @IsString()
  @Length(2, 140)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    example: 'Deskripsi singkat',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(500)
  description?: string;
}
export class UpdateTaxonomyDto {
  @ApiPropertyOptional({
    type: String,
    minLength: 2,
    maxLength: 100,
    example: 'Berita Nasional',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(2, 100)
  name?: string;
  @ApiPropertyOptional({
    type: String,
    minLength: 2,
    maxLength: 140,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.source,
    example: 'berita-lokal-pertama',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(2, 140)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    example: 'Deskripsi singkat',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(500)
  description?: string;
}
