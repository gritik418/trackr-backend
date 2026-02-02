import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from 'src/auth/types/jwt-payload.type';
import { COOKIE_NAME } from 'src/common/constants/cookie-name';

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();

    const token = req.cookies[COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Unauthenticated');

    const verify =
      await this.jwtService.verify<Promise<JwtPayload | null>>(token);

    if (!verify || !verify.email || !verify.id)
      throw new UnauthorizedException('Unauthenticated');

    req.user = {
      email: verify.email,
      id: verify.id,
    };
    return true;
  }
}
