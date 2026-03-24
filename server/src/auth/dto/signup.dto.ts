import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsIn, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({ 
    example: '+919876543210', 
    required: false, // ✅ Mark as optional in Swagger
    description: 'Optional phone number'
  })
  @IsOptional() // ✅ Make phone optional
  @IsString()
  phone?: string; // ✅ Add ? to make it optional in TypeScript

  @ApiProperty({ 
    example: 'user', 
    enum: ['user', 'admin'], 
    required: false,
    default: 'user'
  })
  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: 'user' | 'admin';
}
