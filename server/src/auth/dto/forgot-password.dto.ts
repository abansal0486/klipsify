// src/auth/dto/forgot-password.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'; // ✅ ADD THIS

export class ForgotPasswordDto {
  @ApiProperty({ 
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  @IsNotEmpty() // ✅ ADD THIS
  @IsEmail()    // ✅ ADD THIS
  @IsString()   // ✅ ADD THIS
  email: string;
}
