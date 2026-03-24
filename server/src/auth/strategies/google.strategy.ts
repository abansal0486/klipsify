// src/auth/strategies/google.strategy.ts - FIXED VERSION
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    // ✅ Validate required config at startup
    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error(
        'Missing Google OAuth configuration. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL'
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });

    this.logger.log('✅ Google OAuth Strategy initialized successfully');
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, displayName, emails, photos } = profile;

      // ✅ Validate required fields
      if (!emails || !emails[0]?.value) {
        this.logger.error('Google profile missing email');
        return done(new UnauthorizedException('Email not provided by Google'), false);
      }

      if (!id) {
        this.logger.error('Google profile missing ID');
        return done(new UnauthorizedException('Invalid Google profile'), false);
      }

      const user = {
        email: emails[0].value,
        googleId: id,
        name: displayName || emails[0].value.split('@')[0], // ✅ Fallback name
        avatar: photos?.[0]?.value || null,
      };

      this.logger.log(`✅ Google OAuth validated for: ${user.email}`);
      done(null, user);
    } catch (error) {
      this.logger.error(`❌ Google OAuth validation failed: ${error.message}`);
      done(error, false); // ✅ Changed from null to false
    }
  }
}
