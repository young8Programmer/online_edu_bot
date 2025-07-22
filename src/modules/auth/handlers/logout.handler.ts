import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class LogoutHandler {
  constructor(
    private readonly authService: AuthService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const isAdmin = await this.authService.isAdmin(msg.from.id.toString());
    const language = msg.from.language_code && ['uz', 'ru', 'en'].includes(msg.from.language_code) ? msg.from.language_code : 'uz';

    if (!isAdmin) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.not_logged_in', language));
      return;
    }

    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('success.logout', language),
      {
        reply_markup: {
          keyboard: [
            [this.i18nService.getTranslation('menu.user_panel', language)],
            [this.i18nService.getTranslation('menu.help', language)],
          ],
          resize_keyboard: true,
        },
      },
    );
  }
}