import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.schema';
import { HashingService } from 'src/common/hashing/hashing.service';
import { EmailProducer } from 'src/queues/email/email.producer';
import { generateVerificationCode } from 'src/common/utils/verification-code.utils';
import { EmailVerificationDto } from './dto/email-verification.schema';
import { LoginDto } from './dto/login.schema';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './types/jwt-payload.type';
import { Response } from 'express';
import { COOKIE_NAME } from 'src/common/constants/cookie-name';
import { cookieOptions } from 'src/common/constants/cookie-options';
import { ResendVerificationEmailDto } from './dto/resend-verification-email.schema';
import { ForgotPasswordDto } from './dto/forgot-password.schema';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { ResetPasswordDto } from './dto/reset-password.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtSerive: JwtService,
    private readonly prismaService: PrismaService,
    private readonly emailProducer: EmailProducer,
    private readonly hashingService: HashingService,
    private readonly configService: ConfigService,
  ) {}

  async userRegister(data: RegisterDto) {
    const { name, email, username, password } = data;
    const existingEmail = await this.prismaService.user.findFirst({
      where: {
        email,
        isVerified: true,
      },
    });

    if (existingEmail) {
      throw new BadRequestException('Email already exists.');
    }

    const existingUsername = await this.prismaService.user.findFirst({
      where: {
        username,
        isVerified: true,
      },
    });

    if (existingUsername) {
      throw new BadRequestException('Username already exists.');
    }

    await this.prismaService.user.deleteMany({
      where: {
        OR: [
          {
            username,
            isVerified: false,
          },
          {
            email,
            isVerified: false,
          },
        ],
      },
    });

    const hashedPassword: string =
      await this.hashingService.hashValue(password);
    const verificationToken: string = generateVerificationCode();
    const hashedVerificationToken: string = await this.hashingService.hashValue(
      verificationToken,
      8,
    );

    await this.prismaService.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
        isVerified: false,
        verificationToken: hashedVerificationToken,
        verificationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    this.emailProducer.sendVerificationEmail({
      email,
      name,
      verificationToken,
    });

    return {
      success: true,
      message:
        'Your account has been created! Check your email to verify your account.',
    };
  }

  async verifyEmail(data: EmailVerificationDto) {
    const { email, otp } = data;

    const user = await this.prismaService.user.findFirst({
      where: {
        email,
        isVerified: false,
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    if (
      !user.verificationTokenExpiry ||
      !user.verificationToken ||
      user.verificationTokenExpiry?.getTime() < new Date().getTime()
    )
      throw new BadRequestException('OTP Expired.');

    const verify = await this.hashingService.compareHash(
      otp,
      user.verificationToken,
    );

    if (!verify) throw new BadRequestException('Wrong OTP.');

    await this.prismaService.user.update({
      where: { email },
      data: {
        verificationToken: null,
        verificationTokenExpiry: null,
        isVerified: true,
      },
    });

    return {
      success: true,
      message: 'Account verified successfully.',
    };
  }

  async login(data: LoginDto, res: Response) {
    const { identifier, password } = data;

    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [
          { email: identifier, isVerified: true },
          { username: identifier, isVerified: true },
        ],
      },
    });

    if (!user || !user.isVerified)
      throw new UnauthorizedException('Invalid credentials.');

    const verify = await this.hashingService.compareHash(
      password,
      user.password,
    );

    if (!verify) throw new UnauthorizedException('Invalid credentials.');

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
    };

    const token = this.jwtSerive.sign(payload);
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return {
      success: true,
      message: 'Logged in successfully.',
    };
  }

  async resendVerificationEmail(data: ResendVerificationEmailDto) {
    const { email } = data;

    const user = await this.prismaService.user.findFirst({
      where: { email, isVerified: false },
    });

    if (!user) throw new NotFoundException('User not found.');

    const verificationToken: string = generateVerificationCode();
    const hashedVerificationToken: string = await this.hashingService.hashValue(
      verificationToken,
      8,
    );

    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        verificationToken: hashedVerificationToken,
        verificationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    this.emailProducer.sendVerificationEmail({
      email,
      name: user.name,
      verificationToken,
    });

    return {
      success: true,
      message: 'Verification Email resent successfully.',
    };
  }

  async logout(res: Response) {
    res.clearCookie(COOKIE_NAME, cookieOptions);

    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }

  async forgotPassword(data: ForgotPasswordDto) {
    const { email } = data;

    const user = await this.prismaService.user.findFirst({
      where: { email, isVerified: true },
    });

    if (!user) throw new NotFoundException('User not found.');

    const resetToken: string = uuidv4();
    const hashedResetToken: string = await this.hashingService.hashValue(
      resetToken,
      8,
    );

    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedResetToken,
        passwordResetTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const resetLink: string = `${this.configService.get('CLIENT_URL')}/reset-password?token=${resetToken}&email=${user.email}`;

    this.emailProducer.sendForgotPasswordEmail({
      email,
      name: user.name,
      resetLink,
    });

    return {
      success: true,
      message:
        'If an account with this email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(data: ResetPasswordDto) {
    const { email, token, password } = data;

    const user = await this.prismaService.user.findFirst({
      where: { email, isVerified: true },
    });

    if (!user) throw new NotFoundException('User not found.');

    if (
      !user.passwordResetToken ||
      !user.passwordResetTokenExpiry ||
      user.passwordResetTokenExpiry.getTime() < Date.now()
    )
      throw new NotFoundException('Reset link has expired.');

    const verify = await this.hashingService.compareHash(
      token,
      user.passwordResetToken,
    );
    if (!verify) throw new BadRequestException('Invalid reset link.');

    const hashedPassword = await this.hashingService.hashValue(password);

    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    });

    return {
      success: true,
      message:
        'Your password has been reset successfully. You can now log in with your new password.',
    };
  }
}
