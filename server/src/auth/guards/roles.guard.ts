// src/auth/guards/roles.guard.ts - OPTIMIZED VERSION
import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  ForbiddenException,
  Logger 
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ✅ Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // ✅ No roles required - allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // ✅ User not authenticated
    if (!user) {
      this.logger.warn('Roles guard: User not authenticated');
      throw new ForbiddenException('Authentication required');
    }

    // ✅ User has no role assigned
    if (!user.role) {
      this.logger.warn(`Roles guard: User ${user.email} has no role assigned`);
      throw new ForbiddenException('User has no role assigned');
    }

    // ✅ Check if user role matches any required role
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      const endpoint = `${request.method} ${request.url}`;
      this.logger.warn(
        `Access denied: User ${user.email} (role: ${user.role}) attempted to access ${endpoint} (requires: ${requiredRoles.join(', ')})`
      );
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
