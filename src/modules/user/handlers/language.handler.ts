import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class LanguageHandler {
  constructor(
    
        @Inject(forwardRef(() => TelegramService))
        private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot, sendMessage: (chatId: number, message: string, language: string, telegramId: string, forceUserPanel?: boolean, user?: any) => Promise<void>) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const message = this.i18nService.getTranslation('menu.language', language) || 'Iltimos, tilni tanlang';
    await bot.sendMessage(chatId, ` ${this.telegramService.escapeMarkdown(message)}`, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🇺🇿 O‘zbek', callback_data: 'lang_uz' }],
          [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
          [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  async handleCallbackQuery(callbackQuery: TelegramBot.CallbackQuery, bot: TelegramBot, sendMessage: (chatId: number, message: string, language: string, telegramId: string, forceUserPanel?: boolean, user?: any) => Promise<void>) {
    const chatId = callbackQuery.message.chat.id;
    const telegramId = callbackQuery.from.id.toString();
    const language = callbackQuery.data.split('_')[1] as 'uz' | 'ru' | 'en';
    await this.userService.updateLanguage(telegramId, language);
    const message = this.i18nService.getTranslation('success.language_updated', language) || 'Til muvaffaqiyatli o‘zgartirildi';
    await sendMessage(chatId, message, language, telegramId);
    const user = await this.userService.findByTelegramId(telegramId);
    if (user?.state === 'awaiting_phone') {
      const phoneMessage = this.i18nService.getTranslation('register.phone_request', language);
      await this.telegramService.sendMessage(chatId, phoneMessage, {
        reply_markup: {
          keyboard: [[{ text: this.i18nService.getTranslation('register.share_phone', language), request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    } else if (user?.state === 'awaiting_email') {
      const emailMessage = this.i18nService.getTranslation('register.email_request', language);
      await this.telegramService.sendMessage(chatId, emailMessage, {
        reply_markup: {
          force_reply: true,
        },
      });
    }
    await bot.answerCallbackQuery(callbackQuery.id);
  }
}