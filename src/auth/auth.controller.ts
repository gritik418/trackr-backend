import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import registerSchema, { RegisterDto } from './dto/register.schema';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import emailVerificationSchema, {
  EmailVerificationDto,
} from './dto/email-verification.schema';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() data: RegisterDto) {
    return this.authService.userRegister(data);
  }

  @Post('/verify-email')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(emailVerificationSchema))
  verifyEmail(@Body() data: EmailVerificationDto) {
    return this.authService.verifyEmail(data);
  }
}
