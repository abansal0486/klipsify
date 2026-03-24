// src/auth/decorators/public.decorator.ts - OPTIMIZED VERSION
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route as public (bypasses JWT authentication)
 * @example
 * @Public()
 * @Get('health')
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
