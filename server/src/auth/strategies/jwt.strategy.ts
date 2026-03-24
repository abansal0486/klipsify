// src/auth/strategies/jwt.strategy.ts - FIXED

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured. Please set it in your environment variables.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Priority 1: Extract from HttpOnly cookie
        (request: Request) => {
          // ✅ FIXED: Look for 'token' instead of 'access_token'
          const token = request?.cookies?.token;
          
          if (token) {
            this.logger.debug(`Token found in cookie for ${request.method} ${request.url}`);
            return token;
          }
          
          this.logger.warn(`No token in cookie for ${request.method} ${request.url}`);
          return null;
        },
        // Priority 2: Fallback to Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    this.logger.log('✅ JWT Strategy initialized successfully (Cookie: "token" + Bearer support)');
  }

  async validate(payload: any) {
    if (!payload.sub || !payload.email) {
      this.logger.error('Invalid JWT payload: missing sub or email');
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      this.logger.warn(`Expired token for user: ${payload.email}`);
      throw new UnauthorizedException('Token has expired');
    }

    if (this.configService.get('NODE_ENV') === 'development') {
      this.logger.debug(`JWT validated for: ${payload.email}`);
    }

    return {
      id: payload.sub,
      _id: payload.sub,
      email: payload.email,
      role: payload.role || 'user',
    };
  }
}
