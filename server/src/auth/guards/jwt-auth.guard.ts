// src/auth/guards/jwt-auth.guard.ts - OPTIMIZED VERSION
import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // ✅ Check if route is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true; // ✅ Skip JWT authentication for public routes
    }
    
    // ✅ Apply JWT authentication for protected routes
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // ✅ Enhanced error handling
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const endpoint = `${request.method} ${request.url}`;
      
      // Log authentication failures
      if (info?.name === 'TokenExpiredError') {
        this.logger.warn(`Token expired for ${endpoint}`);
        throw new UnauthorizedException('Token has expired. Please login again.');
      }
      
      if (info?.name === 'JsonWebTokenError') {
        this.logger.warn(`Invalid token for ${endpoint}`);
        throw new UnauthorizedException('Invalid token. Please login again.');
      }

      if (info?.message === 'No auth token') {
        this.logger.warn(`No token provided for ${endpoint}`);
        throw new UnauthorizedException('Authentication required. Please provide a valid token.');
      }

      this.logger.warn(`Authentication failed for ${endpoint}: ${info?.message || 'Unknown error'}`);
      throw err || new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
