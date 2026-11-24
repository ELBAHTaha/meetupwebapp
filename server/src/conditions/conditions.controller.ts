import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ConditionsService } from './conditions.service';
import { ConditionsQueryDto } from './dto/conditions-query.dto';

@ApiTags('conditions')
@Controller('conditions')
export class ConditionsController {
  constructor(private readonly conditions: ConditionsService) {}

  /** Forecast for an outdoor activity. `null` when unavailable — the widget then hides. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get()
  async get(@Query() q: ConditionsQueryDto) {
    return (await this.conditions.get(q.lat, q.lng, new Date(q.at), q.activity)) ?? null;
  }
}
