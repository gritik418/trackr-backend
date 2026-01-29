import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import registerSchema, { RegisterDto } from './dto/register.schema';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() data: RegisterDto) {
    return this.authService.userRegister(data);
  }
}
