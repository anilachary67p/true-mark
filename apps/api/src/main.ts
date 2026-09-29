import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv, getCorsOrigins } from '@truemark/config';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { correlationMiddleware } from './common/middleware/correlation.middleware';
import { UuidParamsPipe } from './common/pipes/uuid-params.pipe';

async function bootstrap() {
  const config = loadEnv();
  const isProduction = config.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  app.use(correlationMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: config.NODE_ENV === 'development' ? true : getCorsOrigins(config),
    credentials: true,
    exposedHeaders: ['x-correlation-id'],
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new UuidParamsPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new CorrelationInterceptor(), new LoggingInterceptor());
  app.enableShutdownHooks();

  if (!isProduction) {
    const swagger = new DocumentBuilder()
      .setTitle('TrueMark API')
      .setDescription('Enterprise product authentication and anti-counterfeit platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  }

  await app.listen(config.API_PORT, config.API_HOST);
  new Logger('Bootstrap').log(`TrueMark API running on http://${config.API_HOST}:${config.API_PORT}`);
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error('API failed to start', error instanceof Error ? error.stack : error);
  process.exit(1);
});
