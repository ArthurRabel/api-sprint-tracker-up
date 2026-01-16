import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import helmet from 'helmet';

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

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", 'https://cdn.socket.io'],
        },
      },
    }),
  );

  app.enableCors({
    origin: CORS_ORIGIN,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sprint Tracker API - IESB')
    .setDescription('Sprint Tracker API documentation by BayArea - IESB')
    .addCookieAuth('sprinttacker-session')
    .setExternalDoc('Additional documentation', 'https://github.com/fabrica-bayarea/Sprint-Tracker')
    .setContact('BayArea', '', 'nde.ads@iesb.br')
    .setLicense(
      'License GPL-3.0',
      'https://github.com/fabrica-bayarea/Sprint-Tracker?tab=GPL-3.0-1-ov-file',
    )
    .addTag(
      'Authentication and Authorization',
      'Authentication and authorization via "sprinttacker-session" cookie (JWT).',
    )
    .addTag('User Profile', 'Operations related to user profile and management.')
    .addTag('Boards', 'Board management (creation, listing, updating and removal).')
    .addTag(
      'Lists',
      'List management within boards (creation, ordering, updating and removal).',
    )
    .addTag(
      'Tasks',
      'Task management within lists (creation, movement, updating, removal and assignment).',
    )
    .setVersion('1.0')
    .addServer(API_GLOBAL_PREFIX)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Sprint Tacker API - IESB',
    customfavIcon: 'https://www.iesb.br/content/themes/iesb-chleba-themosis/favicon.png',
    customCss: `
      .swagger-ui .topbar { 
        background: transparent linear-gradient(96deg, #CC0000 0%, #F00B54 100%) 0% 0% no-repeat padding-box; 
      }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch', 'head'],
    },
  });

  await app.listen(PORT);
  logger.log(`Application is running on: http://localhost:${PORT}`);

  if (NODE_ENV === 'production') {
    process.on('SIGINT', (): void => {
      logger.log('Recebido SIGINT. Desligando...');
      void app.close().then(() => {
        logger.log('Aplicação desligada.');
        process.exit(0);
      });
    });

    process.on('SIGTERM', (): void => {
      logger.log('Recebido SIGTERM. Desligando...');
      void app.close().then(() => {
        logger.log('Aplicação desligada.');
        process.exit(0);
      });
    });
  }
}

void bootstrap();
