import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelSubscriptionDto {
  @ApiProperty({ required: false, description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}
