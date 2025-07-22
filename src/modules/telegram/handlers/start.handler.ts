import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class StartHandler {
  private readonly logger = new Logger(StartHandler.name);

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const defaultLanguage = msg.from.language_code || 'uz';

    try {
      let user = await this.userService.findByTelegramId(telegramId);

      if (!user) {
        this.logger.log(`Creating new user with telegramId: ${telegramId}`);
        user = await this.userService.createUser({
          telegramId,
          fullName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
          language: defaultLanguage,
        });
      }

      const message = this.i18nService.getTranslation('menu.language', user.language || defaultLanguage);
      await this.telegramService.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🇺🇿 O‘zbek', callback_data: 'lang_uz' },
              { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
              { text: '🇬🇧 English', callback_data: 'lang_en' },
            ],
          ],
          persistent: true
        },
      });

      this.logger.log(`Start command handled for user: ${telegramId}`);
    } catch (error) {
      this.logger.error(`Error handling /start for telegramId: ${telegramId}, ${error.message}`);
      const message = this.i18nService.getTranslation('errors.user_not_found', defaultLanguage);
      await this.telegramService.sendMessage(chatId, message);
    }
  }
}