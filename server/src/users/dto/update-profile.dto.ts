import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  country?: string;

  // @IsOptional()
  // @IsString()
  // city?: string;

  // @IsOptional()
  // @IsString()
  // postalCode?: string;

  // profileImage we’ll skip for now
}