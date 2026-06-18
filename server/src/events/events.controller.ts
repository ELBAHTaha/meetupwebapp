import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { JoinEventDto, StartEventDto } from './dto/event-action.dto';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ConsumerGuard } from '../common/guards/consumer.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

// Anti-abuse cap on activity creation: strict in production, relaxed in dev so
// testing isn't blocked. (NODE_ENV is set to 'production' in Docker/prod.)
const CREATE_THROTTLE =
  process.env.NODE_ENV === 'production'
    ? { limit: 5, ttl: 3_600_000 }
    : { limit: 200, ttl: 3_600_000 };

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @OptionalAuth()
  @Get()
  list(@Query() query: QueryEventsDto, @CurrentUser() user?: AuthUser) {
    return this.events.list(query, user?.id);
  }

  // Must be declared before `:id` so "mine" isn't matched as an event id.
  @ApiBearerAuth()
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.events.mine(user.id);
  }

  @OptionalAuth()
  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.events.detail(id, user?.id);
  }

  @Public()
  @Get(':id/attendees')
  attendees(@Param('id') id: string) {
    return this.events.attendees(id);
  }

  // Anti-abuse: cap activity creation per hour per user (see CREATE_THROTTLE).
  @ApiBearerAuth()
  @Throttle({ default: CREATE_THROTTLE })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.events.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.events.update(id, user.id, dto);
  }

  @ApiBearerAuth()
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.cancel(id, user.id);
  }

  @ApiBearerAuth()
  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.confirm(id, user.id);
  }

  @ApiBearerAuth()
  @Post(':id/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StartEventDto) {
    return this.events.start(id, user.id, dto.hostSpotNote);
  }

  // Joining/leaving is consumer behaviour — business accounts host, not attend.
  @ApiBearerAuth()
  @UseGuards(ConsumerGuard)
  @Post(':id/join')
  join(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: JoinEventDto) {
    return this.events.join(id, user.id, dto?.shareContactWithHostBusiness ?? false);
  }

  @ApiBearerAuth()
  @UseGuards(ConsumerGuard)
  @Delete(':id/join')
  leave(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.leave(id, user.id);
  }
}
