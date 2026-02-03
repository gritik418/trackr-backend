import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { UserService } from './user.service';
import { Request } from 'express';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import updateUserSchema, { UpdateUserDto } from './dto/update-user.schema';
import changePasswordSchema, {
  ChangePasswordDto,
} from './dto/change-password.schema';

@UseGuards(AuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  @HttpCode(HttpStatus.OK)
  getUser(@Req() req: Request) {
    return this.userService.getUserProfile(req);
  }

  @Patch('/')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(updateUserSchema))
  updateUser(@Body() data: UpdateUserDto, @Req() req: Request) {
    return this.userService.updateUser(data, req);
  }

  @Patch('/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file) throw new BadRequestException('File is required');
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  updateAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    return this.userService.updateUserAvatar(file, req);
  }

  @Patch('/change-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  changePassword(@Body() data: ChangePasswordDto, @Req() req: Request) {
    return this.userService.changePassword(data, req);
  }
}
