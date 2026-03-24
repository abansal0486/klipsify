// src/auth/dto/update-profile.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsPhoneNumber, IsDateString } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '+919876543210', required: false })
  @IsOptional()
  @IsString()
  @IsPhoneNumber(undefined) // validates phone numbers globally
  phone?: string;

  @ApiProperty({ example: 'India', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  // @ApiProperty({ example: '1990-01-01', required: false })
  // @IsOptional()
  // @IsDateString()
  // dob?: string;

  // @ApiProperty({ example: 'Premium', required: false })
  // @IsOptional()
  // @IsString()
  // subscriptionPlanName?: string;

  // @ApiProperty({ example: true, required: false })
  // @IsOptional()
  // subscriptionActive?: boolean;

  // @ApiProperty({ example: 'Mumbai', required: false })
  // @IsOptional()
  // @IsString()
  // city?: string;

  // @ApiProperty({ example: '400001', required: false })
  // @IsOptional()
  // @IsString()
  // postalCode?: string;
}
