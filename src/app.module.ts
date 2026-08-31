import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { envValidationSchema } from './config/env.validation.js'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { PrismaModule } from './prisma/prisma.module.js'
import { ProductsModule } from './modules/products/products.module.js'
import { HealthModule } from './health/health.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { QuoteRequestsModule } from './modules/quote-requests/quote-requests.module.js'
import { OrdersModule } from './modules/orders/orders.module.js'
import { TestModule } from './modules/test/test.module.js'
import { CompaniesModule } from './modules/companies/companies.module.js'
import { UsersModule } from './modules/users/users.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    PrismaModule,
    ProductsModule,
    HealthModule,
    AuthModule,
    QuoteRequestsModule,
    OrdersModule,
    TestModule,
    CompaniesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
