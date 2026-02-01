import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.schema';
import { HashingService } from 'src/common/hashing/hashing.service';
import { EmailProducer } from 'src/queues/email/email.producer';
import { generateVerificationCode } from 'src/common/utils/verification-code.utils';
import { EmailVerificationDto } from './dto/email-verification.schema';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private emailProducer: EmailProducer,
    private readonly hashingService: HashingService,
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
}
