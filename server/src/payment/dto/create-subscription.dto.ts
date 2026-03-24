// src/payment/dto/create-subscription.dto.ts - UPDATED
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ 
    example: '66f123456789abcd12345678', 
    description: 'User ID from your database' 
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ 
    example: 'gladiator', 
    description: 'Plan ID from constants',
    enum: ['free-flight', 'airborn', 'gladiator', 'samurai', 'ninja-agency', 'infinity']
  })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ 
    example: 'P-1AB23456CD789012E', 
    description: 'PayPal Plan ID (get from /payment/setup/create-plan)' 
  })
  @IsString()
  @IsNotEmpty()
  paypalPlanId: string; // ✅ Added this field
}
