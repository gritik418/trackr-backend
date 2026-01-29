import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.schema';
import { HashingService } from 'src/common/hashing/hashing.service';
import { EmailProducer } from 'src/queues/email/email.producer';

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

    const hashedPassword = await this.hashingService.hashValue(password);

    const user = await this.prismaService.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
        isVerified: false,
      },
    });

    this.emailProducer.sendVerificationEmail({
      email,
      name,
    });

    return {
      success: true,
      message: 'User created successfully',
    };
  }
}
