import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 8000;

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Trackr API running on port ${port}`);
}
bootstrap();
