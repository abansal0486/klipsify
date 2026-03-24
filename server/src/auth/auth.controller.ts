// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================
  // 🔥 CHANGE #1: Add helper method to set secure cookie
  // ============================================
  private setCookie(res: Response, token: string) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    
    res.cookie('token', token, {
      httpOnly: true,           // Cannot be accessed by JavaScript
      secure: isProduction,     // HTTPS only in production
      sameSite: 'lax',          // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }


  // ============================================
  // 🔥 CHANGE #2: Update signup - Add @Res decorator and cookie logic
  // ============================================
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User Signup' })
  @ApiResponse({ status: 201, description: 'User registered' })
  async signup(@Body() signupDto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(signupDto);
    
    // Set HttpOnly cookie with token
    this.setCookie(res, result.access_token);
    
    // Return response WITHOUT token
    return {
      success: result.success,
      message: result.message,
      user: result.user,
      // ❌ DO NOT return access_token here
    };
  }


  // ============================================
  // 🔥 CHANGE #3: Update login - Add @Res decorator and cookie logic
  // ============================================
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User Login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto.email, loginDto.password);
    
    // Set HttpOnly cookie with token
    this.setCookie(res, result.access_token);
    
    // Return only user data
    return {
      user: result.user,
      message: 'Login successful',
      // ❌ DO NOT return access_token here
    };
  }


  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport handles redirect
  }


  // ============================================
  // 🔥 CHANGE #4: Update google callback - Remove token from URL
  // ============================================
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const jwt = await this.authService.googleLogin(req.user as any);
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://samba.ink';

    // Use the helper method to set cookie
    this.setCookie(res, jwt.access_token);

    // ❌ REMOVE: ?token=${jwt.access_token} from URL (security risk!)
    // ✅ NEW: Redirect without token in URL
    res.redirect(`${frontendUrl}/login?googleAuth=success`);
  }


  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request Password Reset' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }


  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset Password' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }


  // ============================================
  // 🔥 CHANGE #5: Update verify-email - Add @Res decorator and cookie logic
  // ============================================
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Email' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyEmail(dto.token);
    
    // Set HttpOnly cookie after email verification
    this.setCookie(res, result.access_token);
    
    // Return response WITHOUT token
    return {
      message: result.message,
      user: result.user,
      // ❌ DO NOT return access_token here
    };
  }


  // ============================================
  // 🔥 CHANGE #6: Update logout - Add @Res decorator and fix cookie clearing
  // ============================================
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User Logout' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req.user as any)?._id;
    if (userId) await this.authService.logout(userId);

    // ✅ FIXED: Clear cookie with path specified
    res.clearCookie('token', { path: '/' });
    
    return { message: 'Logged out successfully' };
  }


  // @Get('me')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Get Current User' })
  // me(@Req() req: Request) {
  //   return { user: req.user };
  // }
}
