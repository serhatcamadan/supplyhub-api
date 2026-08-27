import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module.js'
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalFilters(new GlobalExceptionFilter())

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SupplyHub API')
      .setDescription('B2B Tedarik Platformu REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api', app, document)
  }

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`SupplyHub API → http://localhost:${port}`)
  console.log(`Swagger UI   → http://localhost:${port}/api`)
}

await bootstrap()
