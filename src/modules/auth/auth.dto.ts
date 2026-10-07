import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
export class LoginDto {
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
    minLength: 1,
    maxLength: 128,
    example: 'contoh-password-aman',
    writeOnly: true,
  })
  @IsString()
  @Length(1, 128)
  password!: string;
}
export class RefreshDto {
  @ApiProperty({ type: String, minLength: 89, maxLength: 89 })
  @IsString()
  @Length(89, 89)
  refreshToken!: string;
}
