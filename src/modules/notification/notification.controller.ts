import { Controller, Post, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  async sendNotification(@Body() body: { telegramId: string; message: string }) {
    await this.notificationService.sendNotification(body.telegramId, body.message);
    return { message: 'Notification sent successfully' };
  }

  @Post('broadcast')
  async broadcast(@Body() body: { message: string }) {
    await this.notificationService.broadcast(body.message);
    return { message: 'Broadcast sent successfully' };
  }
}