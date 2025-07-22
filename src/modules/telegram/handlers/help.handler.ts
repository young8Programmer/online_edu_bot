import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class HelpHandler {
  private readonly logger = new Logger(HelpHandler.name);

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language || 'uz';

    try {
      const message = this.i18nService.getTranslation('help.message', language);
      await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
    } catch (error) {
      this.logger.error(`Error handling help for telegramId: ${telegramId}, ${error.message}`);
      const message = this.i18nService.getTranslation('errors.user_not_found', language);
      await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
    }
  }
}