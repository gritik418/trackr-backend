import { SetMetadata } from '@nestjs/common';
import { Limit } from '../enums/limit.enum';

export const LIMIT_KEY = 'limit';

export const Subscription = (...limits: Limit[]) =>
  SetMetadata(LIMIT_KEY, limits);
