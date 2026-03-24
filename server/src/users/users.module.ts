import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
// import { Plan, PlanSchema } from '../plans/schemas/plan.schema';
import { Transaction, TransactionSchema } from '../payment/schemas/transaction.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    // { name: Plan.name, schema: PlanSchema },
    { name: Transaction.name, schema: TransactionSchema }
  ])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule], // allow AuthService to use it
})
export class UsersModule { }
