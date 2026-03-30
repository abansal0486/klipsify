// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';

// async function bootstrap() {

//   const app = await NestFactory.create<NestExpressApplication>(AppModule);
//   app.use(cookieParser());

import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.use(cookieParser());
  // Enable JSON for all routes EXCEPT Stripe

  // ✅ Stripe webhook MUST be raw FIRST
  app.use(
    '/payment/stripe/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

  // ✅ JSON parser for everything else
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  // Set Fateway Tiemout issue resolve
  // app.use((req, res, next) => {
  //   req.setTimeout(600000); // 10 minutes
  //   res.setTimeout(600000); // 10 minutes
  //   next();
  // });

  // Serve uploads folder
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Swagger config
  const config = new DocumentBuilder()
    .setTitle('Social AI Pro API')
    .setDescription('API docs for Social AI Pro')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // localhost:3000/api/docs

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://localhost:3002',
      process.env.FRONTEND_URL || 'http://localhost:5173', // ✅ Fallback instead of filter
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ✅ ADD: Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Change this to false
      transform: true,
    }),
  );

  // ✅ Optional: Apply JWT Guard globally (uncomment if needed)
  // const reflector = app.get(Reflector);
  // app.useGlobalGuards(
  //   new JwtAuthGuard(reflector),
  //   new RolesGuard(reflector),
  // );

  const port = process.env.PORT || 3002;
  console.log(`🚀 Application starting on port ${port}`);
  await app.listen(port);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
