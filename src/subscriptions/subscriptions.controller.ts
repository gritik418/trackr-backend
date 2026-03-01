import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Request } from 'express';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import {
  ClaimEarlyAccessDto,
  claimEarlyAccessSchema,
} from './dto/claim-early-access.schema';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('early-access')
  @UsePipes(new ZodValidationPipe(claimEarlyAccessSchema))
  async claimEarlyAccess(
    @Body() body: ClaimEarlyAccessDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.claimEarlyAccess(body.planId, req);
  }
}
