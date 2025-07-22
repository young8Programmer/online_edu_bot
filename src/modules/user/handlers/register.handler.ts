import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { UserService } from '../user.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class RegisterHandler {
  private readonly logger = new Logger(RegisterHandler.name);

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
        if (msg.contact) {
          this.logger.log(`Creating user with telegramId: ${telegramId}, phone: ${msg.contact.phone_number}`);
          user = await this.userService.createUser({
            telegramId,
            fullName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
            phoneNumber: msg.contact.phone_number,
            language: defaultLanguage,
          });

          const message = this.i18nService.getTranslation('register.email_request', defaultLanguage);
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: {
              force_reply: true,
            },
          });
          return;
        }

        this.logger.log(`Prompting phone number for telegramId: ${telegramId}`);
        const message = this.i18nService.getTranslation('register.phone_request', defaultLanguage);
        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: {
            keyboard: [[{ text: this.i18nService.getTranslation('register.share_phone', defaultLanguage), request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
            persistent: true,
          },
        });
        return;
      }

      if (!user.phoneNumber && msg.contact) {
        this.logger.log(`Updating phone number for telegramId: ${telegramId}, phone: ${msg.contact.phone_number}`);
        await this.userService.updateUser(telegramId, { phoneNumber: msg.contact.phone_number });

        const message = this.i18nService.getTranslation('register.email_request', user.language || defaultLanguage);
        await this.telegramService.sendMessage(chatId, message, {
          reply_markup: {
            force_reply: true,
          },
        });
        return;
      }

      if (!user.email && msg.text && !msg.contact) {
        const email = msg.text.trim();
        if (!this.isValidEmail(email)) {
          this.logger.warn(`Invalid email format for telegramId: ${telegramId}, email: ${email}`);
          const message = this.i18nService.getTranslation('errors.invalid_email', user.language || defaultLanguage);
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: {
              force_reply: true,
            },
          });
          return;
        }

        this.logger.log(`Updating email for telegramId: ${telegramId}, email: ${email}`);
        await this.userService.updateUser(telegramId, { email });

        const message = this.i18nService.getTranslation('success.registered', user.language || defaultLanguage);
        await this.telegramService.sendMessageWithMenu(chatId, message, user.language || defaultLanguage, telegramId);
        return;
      }

      this.logger.log(`User ${telegramId} already registered, ignoring message`);
    } catch (error) {
      this.logger.error(`Error handling registration for telegramId: ${telegramId}, ${error.message}`);
      const message = this.i18nService.getTranslation('errors.user_not_found', defaultLanguage);
      await this.telegramService.sendMessageWithMenu(chatId, message, defaultLanguage, telegramId);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}