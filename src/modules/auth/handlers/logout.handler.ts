import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { TelegramService } from '../../telegram/telegram.service';
import { UserService } from '../../user/user.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class LogoutHandler {
  constructor(
    private readonly authService: AuthService,
    private readonly i18nService: I18nService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = BigInt(msg.from.id).toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    const isAdmin = await this.authService.isAdmin(telegramId);
    if (!isAdmin) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.not_logged_in', language));
      return;
    }

    await this.telegramService.sendMessageWithMenu(
      chatId,
      this.i18nService.getTranslation('success.logout', language),
      language,
      telegramId,
    );
  }
}