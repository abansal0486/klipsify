// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly TOKEN_EXPIRY = 3600 * 1000;

  constructor(
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(signupDto: any) {
    const { email, password, name, phone, role = 'user' } = signupDto;
    this.logger.log(`Signup: ${email}`);

    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new BadRequestException('User already exists');

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
    const verificationToken = randomBytes(32).toString('hex');

    const result = await this.usersService.createUser({
      email,
      password: hashedPassword,
      name,
      phone,
      role,
      emailVerified: false,
      emailVerificationToken: verificationToken,
    });

    if (!result.isSuccess) throw new BadRequestException(result.message);

    this.logger.log(`User created: ${result.data}`);

    await this.subscriptionsService.createSubscription({
      userId: result.data._id,
    });

    // Fire-and-forget email
    this.sendVerificationEmail(result.data).catch(err => 
      this.logger.error(`Verification email failed: ${err.message}`)
    );

    return {
      success: true,
      message: 'Signup successful. Please verify your email.',
      ...this.generateToken(result.data),
    };
  }

  async login(email: string, password: string) {
    this.logger.log(`Login: ${email}`);

    const user = await this.usersService.findByEmail(email);
    if (!user?.password) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    this.logger.log(`Login success: ${email}`);
    return this.generateToken(user);
  }

  async googleLogin(googleUser: any) {
    const { googleId, email, name, phone } = googleUser;
    this.logger.log(`Google login: ${email}`);

    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      const result = await this.usersService.createUser({
        email,
        googleId,
        name,
        phone,
        emailVerified: true,
      });
      user = result.data;
    }

    return this.generateToken(user);
  }

  private generateToken(user: any) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role || 'user',
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        emailVerified: !!user.emailVerified,
      },
    };
  }

  async forgotPassword(email: string) {
    this.logger.log(`Password reset: ${email}`);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('Email not found');

    const token = randomBytes(32).toString('hex');
    await this.usersService.updateUser(String(user._id), {
      resetPasswordToken: token,
      resetPasswordExpires: new Date(Date.now() + this.TOKEN_EXPIRY),
    });

    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
    
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`Reset URL: ${resetUrl}`);
    }

    return { message: 'Reset link sent to email' };
  }

  async resetPassword(token: string, newPassword: string) {
  const user = await this.usersService.findByResetToken(token);
  if (!user) throw new BadRequestException('Invalid or expired token');

  const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
  
  // ✅ Direct MongoDB update (bypass updateUser validation)
  await this.usersService.resetPasswordDirect(
    String(user._id),
    hashedPassword
  );

  return { message: 'Password reset successful' };
}


  private async sendVerificationEmail(user: any) {
    const token = user.emailVerificationToken || randomBytes(32).toString('hex');
    if (!user.emailVerificationToken) {
      await this.usersService.updateUser(user._id.toString(), { emailVerificationToken: token });
    }

    const verifyUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`Verify URL: ${verifyUrl}`);
    }
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByVerificationToken(token);
    if (!user) throw new BadRequestException('Invalid or expired token');

    await this.usersService.updateUser(String(user._id), {
      emailVerified: true,
      emailVerificationToken: null,
    });

    return {
      message: 'Email verified successfully',
      ...this.generateToken(user),
    };
  }

  async logout(userId: string) {
    // Token blacklist or Redis invalidation can be added here
    this.logger.log(`Logout: ${userId}`);
  }
}
