import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('events/:id/chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  getThread(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.getThread(id, user.id);
  }

  @Post('messages')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.sendMessage(id, user.id, dto.text);
  }
}
