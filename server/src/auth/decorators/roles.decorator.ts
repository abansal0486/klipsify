// src/auth/decorators/roles.decorator.ts - OPTIMIZED VERSION
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access a route
 * @param roles - Array of role names (e.g., 'admin', 'user', 'moderator')
 * @example
 * @Roles('admin')
 * @Roles('admin', 'moderator')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
