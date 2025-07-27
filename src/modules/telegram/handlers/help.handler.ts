import { Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class HelpHandler {
  constructor(
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot, sendMessage: (chatId: number, message: string, language: string, telegramId: string, forceUserPanel?: boolean, user?: any) => Promise<void>) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language || 'uz';
    const message = this.i18nService.getTranslation('help.message', language) || 'Bu botda yordam uchun ma\'lumotlar...';
    await sendMessage(chatId, message, language, telegramId);
  }
}