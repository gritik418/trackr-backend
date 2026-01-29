import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashingService {
  async hashValue(value: string, rounds: number = 10): Promise<string> {
    return bcrypt.hash(value, rounds);
  }

  async compareHash(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}
