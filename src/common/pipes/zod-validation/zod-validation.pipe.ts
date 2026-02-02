import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodObject } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodObject) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;

    const result = this.schema.safeParse(parsed);

    if (!result.success) {
      const formattedErrors = result.error.issues.reduce(
        (acc, issue) => {
          const field = issue.path.join('.') || 'body';
          if (!Object.keys(acc).includes(field)) acc[field] = issue.message;
          return acc;
        },
        {} as Record<string, string>,
      );

      throw new BadRequestException({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    return result.data;
  }
}
