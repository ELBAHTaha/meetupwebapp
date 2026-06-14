import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityTypesService } from './activity-types.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('activity-types')
@Controller('activity-types')
export class ActivityTypesController {
  constructor(private readonly service: ActivityTypesService) {}

  @Public()
  @Get()
  list() {
    return this.service.list();
  }

  @ApiBearerAuth()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateActivityTypeDto) {
    return this.service.createCustom(user.id, dto);
  }
}
