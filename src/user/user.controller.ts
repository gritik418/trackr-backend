import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { Request } from 'express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  @HttpCode(HttpStatus.OK)
  getUser(@Req() req: Request) {
    return this.userService.getUserProfile(req);
  }
}
