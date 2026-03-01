import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import {
  ClaimEarlyAccessDto,
  claimEarlyAccessSchema,
} from './dto/claim-early-access.schema';
import { SubscriptionsService } from './subscriptions.service';

@UseGuards(AuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('active')
  async getActiveSubscription(@Req() req: Request) {
    return this.subscriptionsService.getActiveSubscription(req);
  }

  @Get('history')
  async getSubscriptionHistory(@Req() req: Request) {
    return this.subscriptionsService.getSubscriptionHistory(req);
  }

  @Post('early-access')
  @UsePipes(new ZodValidationPipe(claimEarlyAccessSchema))
  async claimEarlyAccess(
    @Body() body: ClaimEarlyAccessDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.claimEarlyAccess(body.planId, req);
  }
}
