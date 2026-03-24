import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: '65f2c9b1a7b1c23456789abc' })
  @IsMongoId()
  userId: string;
}
