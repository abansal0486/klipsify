import { IsString, IsEmail, IsNotEmpty, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  readonly email: string;

  @ApiProperty({ description: 'User password (min 8 characters)', example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  readonly password: string;

  @ApiProperty({ description: 'User role', enum: ['user', 'admin'], default: 'user' })
  @IsEnum(['user', 'admin'])
  @IsOptional()
  readonly role?: string;
}
