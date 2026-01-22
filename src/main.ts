import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const NODE_ENV = configService.get<string>('NODE_ENV') || 'development';
  const DEBUG = configService.get<string>('DEBUG') === 'true';
  const CORS_ORIGIN = configService.get<string>('CORS_ORIGIN') || '*';
  const PORT = configService.get<string>('PORT') ?? 3000;
  const API_GLOBAL_PREFIX = configService.get<string>('API_GLOBAL_PREFIX') || '';

  app.setGlobalPrefix(API_GLOBAL_PREFIX);

  app.useLogger(DEBUG ? ['log', 'error', 'warn', 'debug', 'verbose'] : ['log', 'error', 'warn']);

  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.use(
    session({
      secret: 'my-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: CORS_ORIGIN,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const docsPath = path.join(process.cwd(), 'INTRODUCTION.md');
  let description = 'Sprint Tracker API documentation by Arthur Rabelo, fork from BayArea.';

  try {
    description = fs.readFileSync(docsPath, 'utf8');
  } catch {
    logger.warn('file INTRODUCTION.md not found. Using default description for docs.');
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API docs - Sprint Tracker Up')
    .setDescription(description)
    .addCookieAuth('sprinttacker-session')
    .setExternalDoc('Additional documentation', 'https://github.com/ArthurRabel/api-sprint-tracker-up')
    .setContact('Arthur Rabelo', '', 'arthur.rabelo@outlook.com')
    .setLicense(
      'License GPL-3.0',
      'https://github.com/ArthurRabel/api-sprint-tracker-up/blob/main/LICENSE.md',
    )
    .addTag(
      'Authentication and Authorization',
      'Endpoints for login, logout, token generation, password management, and session validation using JWT in cookies.'
    )
    .addTag(
      'User',
      'User profile management, registration, update, and retrieval of user information.'
    )
    .addTag(
      'Boards',
      'Create, list, update, and delete boards. Manage board settings and members.'
    )
    .addTag(
      'Lists',
      'Manage lists within boards: create, order, update, and remove lists.'
    )
    .addTag(
      'Tasks',
      'CRUD operations for tasks, move between lists, assign users, update status, and delete.'
    )
    .addTag(
      'Imports',
      'Import data into the system, including bulk operations and validations.'
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Sprint Tacker API - IESB',
    customCss: `
      .renderedMarkdown h1, .renderedMarkdown h2{
        font-size: 1.1rem;
      }
      .renderedMarkdown h3{
        font-size: 0.9rem;
        }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch', 'head'],
    },
  });

  app.use(
    '/scalar',
    apiReference({
      content: document,
      theme: 'none',
      layout: 'modern',
      pageTitle: 'API docs - Sprint Tracker Up',
      showDeveloperTools: 'never',
      darkMode: true,
      hideClientButton: true,
      cdn: '/assets/scalar.min.js',
    }),
  );

  await app.listen(PORT);
  logger.log(`Application is running on: http://localhost:${PORT}`);

  if (NODE_ENV === 'production') {
    process.on('SIGINT', (): void => {
      logger.log('Received SIGINT. Shutting down...');
      void app.close().then(() => {
        logger.log('Application shut down.');
        process.exit(0);
      });
    });

    process.on('SIGTERM', (): void => {
      logger.log('Received SIGTERM. Shutting down...');
      void app.close().then(() => {
        logger.log('Application shut down.');
        process.exit(0);
      });
    });
  }
}

void bootstrap();
