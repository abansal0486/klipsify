import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBrandProductDto {
  @ApiPropertyOptional({ example: 'Nova Laptop Pro' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  productName?: string;

  @ApiPropertyOptional({ example: 'High performance laptop' })
  @IsString()
  @IsOptional()
  description?: string;
}
