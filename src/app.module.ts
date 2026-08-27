import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { envValidationSchema } from './config/env.validation.js'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
