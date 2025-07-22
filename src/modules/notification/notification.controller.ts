import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  async sendNotification(@Body() body: { telegramId: string; message: string }) {
    try {
      await this.notificationService.sendNotification(body.telegramId, body.message);
      return { message: 'Notification sent successfully' };
    } catch (error) {
      throw new NotFoundException('Failed to send notification');
    }
  }

  @Post('broadcast')
  async broadcast(@Body() body: { message: string }) {
    try {
      await this.notificationService.broadcast(body.message);
      return { message: 'Broadcast sent successfully' };
    } catch (error) {
      throw new NotFoundException('Failed to send broadcast');
    }
  }
}