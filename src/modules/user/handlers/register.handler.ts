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
            state: 'awaiting_email',
          });

          const message =
            this.i18nService.getTranslation('register.email_request', defaultLanguage) ||
            'Iltimos, email manzilingizni kiriting:';
          await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              force_reply: true,
            },
          });
          return;
        }

        this.logger.log(`Prompting phone number for telegramId: ${telegramId}`);
        const message =
          this.i18nService.getTranslation('register.phone_request', defaultLanguage) ||
          'Iltimos, telefon raqamingizni yuboring';
        await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            keyboard: [[{
              text: this.i18nService.getTranslation('register.share_phone', defaultLanguage) ||
                '📱 Telefon raqamni yuborish',
              request_contact: true
            }]],
            resize_keyboard: true,
            one_time_keyboard: true,
            persistent: true,
          },
        });
        return;
      }

      if (!user.phoneNumber && msg.contact) {
        this.logger.log(`Updating phone number for telegramId: ${telegramId}, phone: ${msg.contact.phone_number}`);
        await this.userService.updateUser(telegramId, {
          phoneNumber: msg.contact.phone_number,
          state: 'awaiting_email',
        });

        const message =
          this.i18nService.getTranslation('register.email_request', user.language || defaultLanguage) ||
          'Iltimos, email manzilingizni kiriting:';
        await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
          parse_mode: 'MarkdownV2',
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
          const message =
            this.i18nService.getTranslation('errors.invalid_email', user.language || defaultLanguage) ||
            'Email formati noto‘g‘ri, qayta kiriting.';
          await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              force_reply: true,
            },
          });
          return;
        }

        this.logger.log(`Updating email for telegramId: ${telegramId}, email: ${email}`);
        await this.userService.updateUser(telegramId, {
          email,
          state: 'registered',
        });

        const message =
          this.i18nService.getTranslation('success.registered', user.language || defaultLanguage) ||
          '✅ Ro‘yxatdan o‘tish muvaffaqiyatli yakunlandi!';
        await this.telegramService.sendMessageWithMenu(chatId, this.escapeMarkdown(message), user.language || defaultLanguage, telegramId);
        return;
      }

      this.logger.log(`User ${telegramId} already registered, ignoring message`);
    } catch (error) {
      this.logger.error(`Error handling registration for telegramId: ${telegramId}, ${error.message}`);
      const message =
        this.i18nService.getTranslation('errors.user_not_found', defaultLanguage) ||
        'Foydalanuvchi topilmadi, qayta urinib ko‘ring.';
      await this.telegramService.sendMessageWithMenu(chatId, this.escapeMarkdown(message), defaultLanguage, telegramId);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private escapeMarkdown(text: string): string {
    // Faqat MarkdownV2 maxsus belgilarini escape qiladi
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
}
