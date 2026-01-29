import { Module } from '@nestjs/common';
import { HashingModule } from 'src/common/hashing/hashing.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [HashingModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
