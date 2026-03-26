import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';  // Add this import
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
// import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledPostsModule } from './scheduled-posts/scheduled-posts.module';
import { VideoModule } from './video/video.module';
import { GalleryModule } from './gallery/gallery.module';
import { PaymentModule } from './payment/payment.module';
import { ProjectsModule } from './projects/projects.module';
import { BrandsModule } from './brands/brands.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true, 
      envFilePath: '.env',
      load: [configuration],  // Add this line
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongo.uri'),  // Update this path
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
    AuthModule,
    UsersModule,
    // PlansModule,
    SubscriptionsModule,
    ScheduleModule.forRoot(),
    ScheduledPostsModule,
    VideoModule,
    GalleryModule,
    PaymentModule,
    ProjectsModule,
    BrandsModule,
  ],
})
export class AppModule {}
