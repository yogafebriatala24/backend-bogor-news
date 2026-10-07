import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ListQueryDto, CursorQueryDto } from '../../common/http/query.dto';
import { ARTICLE_STATUSES } from './article.schema';
export class ContentBlockDto {
  @ApiProperty({
    enum: ['paragraph', 'heading', 'quote'],
    example: 'paragraph',
  })
  @IsIn(['paragraph', 'heading', 'quote'])
  type!: string;
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 20000,
    example: 'Isi berita dalam plain text.',
  })
  @IsString()
  @Length(1, 20000)
  text!: string;
}
export class ContentDto {
  @ApiProperty({ enum: [1], example: 1 })
  @IsInt()
  @IsIn([1])
  version!: number;
  @ApiProperty({
    type: () => ContentBlockDto,
    isArray: true,
    maxItems: 200,
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ContentBlockDto)
  blocks!: ContentBlockDto[];
}
export class SeoDto {
  @ApiPropertyOptional({
    type: String,
    maxLength: 160,
    example: 'Berita lokal pertama',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(160)
  title?: string;
  @ApiPropertyOptional({
    type: String,
    maxLength: 320,
    example: 'Deskripsi singkat',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(320)
  description?: string;
  @ApiPropertyOptional({
    type: String,
    maxLength: 2048,
    format: 'uri',
    example: 'https://example.com/berita-lokal-pertama',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(2048)
  canonicalUrl?: string;
}
export class CreateArticleDto {
  @ApiProperty({
    type: String,
    minLength: 5,
    maxLength: 250,
    example: 'Berita lokal pertama',
  })
  @IsString()
  @Length(5, 250)
  title!: string;
  @ApiProperty({
    type: String,
    minLength: 3,
    maxLength: 260,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.source,
    example: 'berita-lokal-pertama',
  })
  @IsString()
  @Length(3, 260)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    example: 'Ringkasan berita lokal.',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(500)
  excerpt?: string;
  @ApiProperty({ type: () => ContentDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ContentDto)
  content!: ContentDto;
  @ApiProperty({
    type: String,
    pattern: '^[a-fA-F0-9]{24}$',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  categoryId!: string;
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    maxItems: 20,
    pattern: '^[a-fA-F0-9]{24}$',
    uniqueItems: true,
    example: ['507f1f77bcf86cd799439011'],
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsMongoId({ each: true })
  tagIds?: string[];
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^[a-fA-F0-9]{24}$',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  thumbnailId?: string | null;
  @ApiPropertyOptional({ type: () => SeoDto })
  @ValidateIf((_o, v) => v !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SeoDto)
  seo?: SeoDto;
}
export class UpdateArticleDto {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    example: 1,
    description:
      'Revision terbaru dari GET admin article. Nilai lama menghasilkan 409.',
  })
  @IsInt()
  @Min(1)
  revision!: number;
  @ApiPropertyOptional({
    type: String,
    minLength: 5,
    maxLength: 250,
    example: 'Berita lokal pertama',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(5, 250)
  title?: string;
  @ApiPropertyOptional({
    type: String,
    minLength: 3,
    maxLength: 260,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.source,
    example: 'berita-lokal-pertama',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(3, 260)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    example: 'Ringkasan berita lokal.',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(500)
  excerpt?: string;
  @ApiPropertyOptional({ type: () => ContentDto })
  @ValidateIf((_o, v) => v !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => ContentDto)
  content?: ContentDto;
  @ApiPropertyOptional({
    type: String,
    pattern: '^[a-fA-F0-9]{24}$',
    example: '507f1f77bcf86cd799439011',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsMongoId()
  categoryId?: string;
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    maxItems: 20,
    pattern: '^[a-fA-F0-9]{24}$',
    uniqueItems: true,
    example: ['507f1f77bcf86cd799439011'],
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsMongoId({ each: true })
  tagIds?: string[];
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^[a-fA-F0-9]{24}$',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  thumbnailId?: string | null;
  @ApiPropertyOptional({ type: () => SeoDto })
  @ValidateIf((_o, v) => v !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SeoDto)
  seo?: SeoDto;
}
export class TransitionDto {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    example: 1,
    description:
      'Revision terbaru dari GET admin article. Nilai lama menghasilkan 409.',
  })
  @IsInt()
  @Min(1)
  revision!: number;
}
export class AdminArticleQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ARTICLE_STATUSES })
  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: (typeof ARTICLE_STATUSES)[number];
}
export class ArticleQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({
    type: String,
    pattern: '^[a-fA-F0-9]{24}$',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;
  @ApiPropertyOptional({
    type: String,
    pattern: '^[a-fA-F0-9]{24}$',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  authorId?: string;
  @ApiPropertyOptional({
    type: String,
    pattern: '^[a-fA-F0-9]{24}$',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  tagId?: string;
}
