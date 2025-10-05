import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  const corsOptions: CorsOptions = {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://pollostellos.web.app',
      'https://pollostellos.com.ar',
      'https://www.pollostellos.com.ar',
    ],
    credentials: true,
  };
  app.enableCors(corsOptions);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
