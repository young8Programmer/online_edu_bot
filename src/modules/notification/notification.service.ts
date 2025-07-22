import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly userService: UserService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
  ) {}

  async sendNotification(telegramId: string, message: string, options?: any): Promise<void> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      this.logger.error(`User not found: ${telegramId}`);
      throw new Error('User not found');
    }

    try {
      await this.telegramService.sendMessage(parseInt(telegramId), message, options);
      this.logger.log(`Notification sent to: ${telegramId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to ${telegramId}: ${error.message}`);
      throw error;
    }
  }

  async broadcast(message: string, options?: any): Promise<void> {
    const users = await this.userService.findAll();
    for (const user of users) {
      try {
        await this.telegramService.sendMessage(parseInt(user.telegramId), message, options);
        this.logger.log(`Broadcast sent to: ${user.telegramId}`);
      } catch (error) {
        this.logger.error(`Failed to send broadcast to ${user.telegramId}: ${error.message}`);
      }
    }
  }
}