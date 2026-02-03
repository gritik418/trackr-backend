import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HashingModule } from './common/hashing/hashing.module';
import { BullModule } from '@nestjs/bullmq';
import { EmailModule } from './queues/email/email.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { UserModule } from './user/user.module';
import { CloudinaryModule } from './providers/cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: Number(config.get<number>('REDIS_PORT')),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    HashingModule,
    EmailModule,
    OrganizationsModule,
    WorkspacesModule,
    UserModule,
    CloudinaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
