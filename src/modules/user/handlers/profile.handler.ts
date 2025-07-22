import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { UserService } from '../user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class ProfileHandler {
  private readonly logger = new Logger(ProfileHandler.name);

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const defaultLanguage = msg.from.language_code && ['uz', 'ru', 'en'].includes(msg.from.language_code) ? msg.from.language_code : 'uz';

    try {
      const user = await this.userService.findByTelegramId(telegramId);
      if (!user) {
        const message = this.i18nService.getTranslation('register.phone_request', defaultLanguage);
        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: {
            keyboard: [[{ text: this.i18nService.getTranslation('register.share_phone', defaultLanguage), request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
        return;
      }

      const profileMessage = this.i18nService.getTranslation('profile.info', user.language, {
        fullName: user.fullName || this.i18nService.getTranslation('profile.not_set', user.language),
        phoneNumber: user.phoneNumber || this.i18nService.getTranslation('profile.not_set', user.language),
        email: user.email || this.i18nService.getTranslation('profile.not_set', user.language),
        language: user.language || this.i18nService.getTranslation('profile.not_set', user.language),
      });

      await this.telegramService.sendMessageWithMenu(chatId, profileMessage, user.language, telegramId);
    } catch (error) {
      this.logger.error(`Error handling profile for telegramId: ${telegramId}, ${error.message}`);
      const message = this.i18nService.getTranslation('errors.user_not_found', defaultLanguage);
      await this.telegramService.sendMessageWithMenu(chatId, message, defaultLanguage, telegramId);
    }
  }
}