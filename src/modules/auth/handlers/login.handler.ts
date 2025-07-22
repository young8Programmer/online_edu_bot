import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class LoginHandler {
  constructor(
    private readonly authService: AuthService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const isAdmin = await this.authService.isAdmin(msg.from.id.toString());
    const language = msg.from.language_code && ['uz', 'ru', 'en'].includes(msg.from.language_code) ? msg.from.language_code : 'uz';

    if (isAdmin) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.already_logged_in', language));
      return;
    }

    await bot.sendMessage(chatId, this.i18nService.getTranslation('admin.password_request', language), {
      reply_markup: {
        force_reply: true,
      },
    });

    bot.once('message', async (reply) => {
      if (reply.chat.id === chatId) {
        const password = reply.text;
        const isValid = await this.authService.validateAdmin(msg.from.id.toString(), password);

        if (isValid) {
          await bot.sendMessage(
            chatId,
            this.i18nService.getTranslation('success.admin_login', language),
            {
              reply_markup: {
                keyboard: [
                  [this.i18nService.getTranslation('admin.manage_courses', language)],
                  [this.i18nService.getTranslation('admin.user_stats', language)],
                  [this.i18nService.getTranslation('admin.payment_history', language)],
                  [this.i18nService.getTranslation('admin.broadcast', language)],
                  [this.i18nService.getTranslation('admin.logout', language)],
                ],
                resize_keyboard: true,
              },
            },
          );
        } else {
          await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.invalid_password', language));
        }
      }
    });
  }
}