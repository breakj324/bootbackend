import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TelegramModule } from './telegram/telegram.module';
import { JobsModule } from './jobs/jobs.module';
import { PrismaService } from './prisma/prisma.service';
import { PromoCodesModule } from './promocodes/promocodes.module';
import { OrdersModule } from './orders/orders.module';
import { ClaimsModule } from './claims/claims.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          return {
            connection: {
              url: redisUrl,
              tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
            },
          };
        }
        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: Number(configService.get<number>('REDIS_PORT', 6379)),
            password: configService.get<string>('REDIS_PASSWORD') || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    TelegramModule,
    JobsModule,
    PromoCodesModule,
    OrdersModule,
    ClaimsModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
