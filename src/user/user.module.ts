import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CloudinaryModule } from 'src/providers/cloudinary/cloudinary.module';
import { HashingModule } from 'src/common/hashing/hashing.module';

@Module({
  imports: [CloudinaryModule, HashingModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
