import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { UserService } from '../user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ProfileHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(
    msg: TelegramBot.Message,
    bot: TelegramBot,
    sendMessage: (
      chatId: number,
      message: string,
      language: string,
      telegramId: string,
      forceUserPanel?: boolean,
      user?: any
    ) => Promise<void>,
  ) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const defaultLanguage =
      msg.from.language_code && ['uz', 'ru', 'en'].includes(msg.from.language_code)
        ? msg.from.language_code
        : 'uz';

    const user = await this.userService.findByTelegramId(telegramId);

    if (!user) {
      const message = this.i18nService.getTranslation('register.phone_request', defaultLanguage);
      await this.telegramService.sendMessage(chatId, message, {
        reply_markup: {
          keyboard: [
            [
              {
                text: this.i18nService.getTranslation('register.share_phone', defaultLanguage),
                request_contact: true,
              },
            ],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      return;
    }

    const fullName = this.telegramService.escapeMarkdown(
      user.fullName || this.i18nService.getTranslation('profile.not_set', user.language),
    );
    const phoneNumber = this.telegramService.escapeMarkdown(
      user.phoneNumber || this.i18nService.getTranslation('profile.not_set', user.language),
    );
    const email = this.telegramService.escapeMarkdown(
      user.email || this.i18nService.getTranslation('profile.not_set', user.language),
    );
    const language = this.telegramService.escapeMarkdown(
      user.language || this.i18nService.getTranslation('profile.not_set', user.language),
    );
    const profileMessage = this.i18nService.getTranslation('profile.info', user.language, {
      fullName,
      phoneNumber,
      email,
      language,
    });
    await this.telegramService.sendMessage(chatId, profileMessage, {
      parse_mode: 'MarkdownV2',
    });
  }
}
