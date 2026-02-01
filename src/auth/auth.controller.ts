import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import registerSchema, { RegisterDto } from './dto/register.schema';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import emailVerificationSchema, {
  EmailVerificationDto,
} from './dto/email-verification.schema';
import loginSchema, { LoginDto } from './dto/login.schema';
import { Response } from 'express';
import resendVerificationEmailSchema, {
  ResendVerificationEmailDto,
} from './dto/resend-verification-email.schema';
import forgotPasswordSchema, {
  ForgotPasswordDto,
} from './dto/forgot-password.schema';

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

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() data: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(data, res);
  }

  @Post('/resend-verification')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(resendVerificationEmailSchema))
  resendVerification(@Body() data: ResendVerificationEmailDto) {
    return this.authService.resendVerificationEmail(data);
  }

  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @Post('/forgot-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  forgotPassword(@Body() data: ForgotPasswordDto) {
    return this.authService.forgotPassword(data);
  }
}
