// src/projects/dto/update-project.dto.ts - ENHANCED VERSION
import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({
    description: 'Project status',
    enum: ['active', 'archived'],
    example: 'active',
  })
  @IsEnum(['active', 'archived'], {
    message: 'Status must be either active or archived',
  })
  @IsOptional()
  status?: 'active' | 'archived';
}
