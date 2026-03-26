import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrandProductDto {
  @ApiProperty({ example: 'Nova Laptop Pro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  productName: string;

  @ApiPropertyOptional({ example: 'High performance laptop' })
  @IsString()
  @IsOptional()
  description?: string;
}
