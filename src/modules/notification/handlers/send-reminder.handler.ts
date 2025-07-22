import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { UserService } from '../../user/user.service';
import { AuthService } from '../../auth/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class SendNotificationHandler {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const language = msg.from.language_code && ['uz', 'ru', 'en'].includes(msg.from.language_code) ? msg.from.language_code : 'uz';

    const isAdmin = await this.authService.isAdmin(telegramId);
    if (!isAdmin) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.access_denied', language));
      return;
    }

    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('admin.notification_id_request', language),
      {
        reply_markup: { force_reply: true },
      },
    );

    bot.once('message', async (reply) => {
      if (reply.chat.id === chatId) {
        const targetTelegramId = reply.text.trim();
        const user = await this.userService.findByTelegramId(targetTelegramId);
        if (!user) {
          await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
          return;
        }

        await bot.sendMessage(
          chatId,
          this.i18nService.getTranslation('admin.notification_message_request', language),
          {
            reply_markup: { force_reply: true },
          },
        );

        bot.once('message', async (messageReply) => {
          if (messageReply.chat.id === chatId) {
            try {
              await this.notificationService.sendNotification(targetTelegramId, messageReply.text);
              await bot.sendMessage(chatId, this.i18nService.getTranslation('success.notification_sent', language));
            } catch (error) {
              await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.invalid_input', language));
            }
          }
        });
      }
    });
  }
}