import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // 🔁 Subscribe a user to a plan
  // @Post()
  // async subscribe(@Body() createSubscriptionDto: CreateSubscriptionDto) {
  //   return this.subscriptionsService.create(createSubscriptionDto); // <- updated method name
  // }

  // 👤 Get current active subscription for a user
  @Get(':userId')
  async getActive(@Param('userId') userId: string) {
    return this.subscriptionsService.findByUser(userId); // <- updated method name
  }
}
