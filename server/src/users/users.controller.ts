// src/users/users.controller.ts
import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';



@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==================== CURRENT USER ====================
  @UseInterceptors(ClassSerializerInterceptor)  
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  getMyProfile(@GetUser('_id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMyProfile(@GetUser('_id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateUser(userId, dto);
  }

  @Put('profile/change-password')
  @ApiOperation({ summary: 'Change password' })
  changeMyPassword(@GetUser('_id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, dto);
  }

  // @Get('me/plan-usage')
  // @ApiOperation({ summary: 'Get current user plan usage' })
  // getMyPlanUsage(@GetUser('_id') userId: string) {
  //   return this.usersService.getUserPlanUsage(userId);
  // }

  @Get('me/current-limits')
  @ApiOperation({ summary: 'Get current user limits' })
  getMyCurrentLimits(@GetUser('_id') userId: string) {
    return this.usersService.getUserCurrentLimits(userId);
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'Get current user transactions' })
  getMyTransactions(@GetUser('_id') userId: string) {
    return this.usersService.getTransactionsByUserId(userId);
  }

  // ==================== ADMIN ONLY ====================

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users (admin)' })
  getAllUsers() {
    return this.usersService.findAll();
  }

  @Post('add-user')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create user (admin)' })
  addUser(@Body() dto: UpdateProfileDto) {
    return this.usersService.createUser(dto);
  }

  @Get('transactions/all')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all transactions (admin)' })
  getAllTransactions() {
    return this.usersService.getTransactions();
  }

  // @Get(':userId/plan-usage')
  // @Roles('admin')
  // @ApiOperation({ summary: 'Get user plan usage by ID (admin)' })
  // getUserPlanUsage(@Param('userId') userId: string) {
  //   return this.usersService.getUserPlanUsage(userId);
  // }

  @Get(':userId/transactions')
  @Roles('admin')
  @ApiOperation({ summary: 'Get user transactions (admin)' })
  getUserTransactions(@Param('userId') userId: string) {
    return this.usersService.getTransactionsByUserId(userId);
  }

  @Put(':userId/profile')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user profile (admin)' })
  updateUserProfile(@Param('userId') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateUser(userId, dto);
  }

  @Delete(':userId')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete user (admin)' })
  async deleteUser(@Param('userId') userId: string) {
    await this.usersService.deleteUser(userId);
    return { message: 'User deleted successfully' };
  }
}
