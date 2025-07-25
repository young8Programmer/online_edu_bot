import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as TelegramBot from 'node-telegram-bot-api';
import { ModuleRef } from '@nestjs/core';
import { telegramConfig } from '../../config/telegram.config';
import { I18nService } from '../i18n/i18n.service';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import { StartHandler } from './handlers/start.handler';
import { HelpHandler } from './handlers/help.handler';
import { AdminHandler } from './handlers/admin.handler';
import { CallbackHandler } from './handlers/callback.handler';
import { RegisterHandler } from '../user/handlers/register.handler';
import { LanguageHandler } from '../user/handlers/language.handler';
import { ProfileHandler } from '../user/handlers/profile.handler';
import { ListCoursesHandler } from '../course/handlers/list-course.handler';
import { ViewProgressHandler } from '../progress/handlers/view-progress.handler';
import { StartQuizHandler } from '../quiz/handlers/start-quiz.handler';
import { ViewCertificatesHandler } from '../certificate/handlers/view-certificate.handler';
import { PaymentHistoryHandler } from '../payment/handlers/payment-history.handler';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: TelegramBot;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly moduleRef: ModuleRef,
    @Inject('FORCED_USER_PANEL_MAP')
    private forcedUserPanelMap: Map<string, boolean>,
  ) {}

  async onModuleInit() {
    const config = telegramConfig(this.configService);
    this.bot = new TelegramBot(config.botToken, { polling: true });

    const startHandler = this.moduleRef.get(StartHandler, { strict: false });
    const helpHandler = this.moduleRef.get(HelpHandler, { strict: false });
    const adminHandler = this.moduleRef.get(AdminHandler, { strict: false });
    const callbackHandler = this.moduleRef.get(CallbackHandler, { strict: false });
    const registerHandler = this.moduleRef.get(RegisterHandler, { strict: false });
    const languageHandler = this.moduleRef.get(LanguageHandler, { strict: false });
    const profileHandler = this.moduleRef.get(ProfileHandler, { strict: false });
    const listCoursesHandler = this.moduleRef.get(ListCoursesHandler, { strict: false });
    const viewProgressHandler = this.moduleRef.get(ViewProgressHandler, { strict: false });
    const startQuizHandler = this.moduleRef.get(StartQuizHandler, { strict: false });
    const viewCertificatesHandler = this.moduleRef.get(ViewCertificatesHandler, { strict: false });
    const paymentHistoryHandler = this.moduleRef.get(PaymentHistoryHandler, { strict: false });

    this.bot.onText(/^\/start$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      const message = this.i18nService.getTranslation('welcome.message', language);
      await this.sendMessageWithMenu(msg.chat.id, message, language, telegramId);
    });

    this.bot.onText(/^\/help$/, async (msg) => {
      await helpHandler.handle(msg, this.bot);
    });

    this.bot.onText(/^\/register$/, async (msg) => {
      await registerHandler.handle(msg, this.bot);
    });

    this.bot.onText(/^\/language$/, async (msg) => {
      await languageHandler.handle(msg, this.bot);
    });

    this.bot.onText(/^\/profile$/, async (msg) => {
      await profileHandler.handle(msg, this.bot);
    });

    this.bot.onText(/^\/admin$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const isAdmin = await this.authService.isAdmin(telegramId);
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      if (isAdmin) {
        const message = this.i18nService.getTranslation('admin.panel', language);
        await this.sendMessageWithAdminMenu(msg.chat.id, message, language);
      } else {
        const message = this.i18nService.getTranslation('errors.access_denied', language);
        await this.sendMessageWithMenu(msg.chat.id, message, language, telegramId);
      }
    });

    this.bot.onText(/🌐/, async (msg) => {
      await languageHandler.handle(msg, this.bot);
    });

    this.bot.onText(/👤/, async (msg) => {
      await profileHandler.handle(msg, this.bot);
    });

    this.bot.onText(/🎓 Kurslar|My courses/, async (msg) => {
      await listCoursesHandler.handle(msg, this.bot);
    });

    this.bot.onText(/📚 Mening kurslarim/, async (msg) => {
      await listCoursesHandler.handle({ ...msg, text: '/my_courses' }, this.bot);
    });

    this.bot.onText(/📊/, async (msg) => {
      await viewProgressHandler.handle(msg, this.bot);
    });

    this.bot.onText(/🧪 Testlar|Quizzes/, async (msg) => {
      await startQuizHandler.handle(msg, this.bot);
    });

    this.bot.onText(/🎖️/, async (msg) => {
      await viewCertificatesHandler.handle(msg, this.bot);
    });

    this.bot.onText(/📂 To‘lovlar tarixi|Payment history/, async (msg) => {
      await paymentHistoryHandler.handle(msg, this.bot);
    });

    this.bot.onText(/ℹ️/, async (msg) => {
      await helpHandler.handle(msg, this.bot);
    });

    this.bot.onText(/📋/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/📊 Foydalanuvchi statistikasi/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/💸 Foydalanuvchilar to‘lovlari/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/📢/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/📚/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/📖/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/📝 Testlarni boshqarish/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/➕/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/🔍 Testlarni ko‘rish/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/🗑/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/Kurslarni ko‘rish|View courses|Курсы/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/Darslarni ko‘rish|View lessons|Уроки/, async (msg) => {
      await adminHandler.handle(msg, this.bot);
    });

    this.bot.onText(/^Orqaga$|^Back$|^Назад$|^🔙 Orqaga$|^🔙 Back$|^🔙 Назад$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      const isAdmin = await this.authService.isAdmin(telegramId);
      if (isAdmin) {
        const message = this.i18nService.getTranslation('admin.panel', language);
        await this.sendMessageWithAdminMenu(msg.chat.id, message, language);
      } else {
        const message = this.i18nService.getTranslation('welcome.message', language);
        await this.sendMessageWithMenu(msg.chat.id, message, language, telegramId);
      }
    });

    this.bot.on('callback_query', async (query) => {
      await callbackHandler.handle(query, this.bot);
    });

    this.bot.on('contact', async (msg) => {
      await registerHandler.handle(msg, this.bot);
    });

    this.bot.on('message', async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      if (msg.text && !msg.contact && !msg.text.startsWith('/') && !this.isMenuCommand(msg.text, language)) {
        await registerHandler.handle(msg, this.bot);
      }
    });
  }

  private isMenuCommand(text: string, language: string): boolean {
    const keys = [
      'menu.courses', 'menu.my_courses', 'menu.progress', 'menu.quizzes',
      'menu.certificates', 'menu.payment_history', 'menu.profile', 'menu.language',
      'menu.help', 'menu.back',
      'admin.user_stats', 'admin.user_payments', 'admin.broadcast',
      'admin.user_panel', 'admin.manage_courses', 'admin.manage_lessons',
      'admin.manage_quizzes', 'admin.create_course', 'admin.view_courses',
      'admin.delete_course', 'admin.create_lesson', 'admin.view_lessons',
      'admin.delete_lesson', 'admin.create_quiz', 'admin.view_quizzes',
      'admin.delete_quiz', 'admin.back',
    ];
    return keys.some((key) => this.i18nService.getTranslation(key, language) === text);
  }

  async sendMessage(chatId: number, message: string, options?: TelegramBot.SendMessageOptions): Promise<void> {
    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...options });
  }

  async sendMessageWithMenu(
  chatId: number,
  message: string,
  language: string,
  telegramId: string,
  forceUserPanel = false,
  user?: any // Foydalanuvchi ma'lumotlarini qabul qilish uchun
): Promise<void> {
  const isAdmin = await this.authService.isAdmin(telegramId);
  if (forceUserPanel) {
    this.forcedUserPanelMap.set(String(chatId), true);
  }
  if (message === '/admin') {
    this.forcedUserPanelMap.delete(String(chatId));
  }
  const hasForcedUserPanel = this.forcedUserPanelMap.get(String(chatId));

  // Xabarni moslashtirish
  const finalMessage = user ? message.replace('{name}', user.fullName || 'Foydalanuvchi') : message;

  if (isAdmin && !hasForcedUserPanel) {
    await this.sendMessageWithAdminMenu(chatId, finalMessage, language);
  } else {
    await this.bot.sendMessage(chatId, finalMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [
            { text: this.i18nService.getTranslation('menu.courses', language) },
            { text: this.i18nService.getTranslation('menu.my_courses', language) },
          ],
          [
            { text: this.i18nService.getTranslation('menu.progress', language) },
            { text: this.i18nService.getTranslation('menu.quizzes', language) },
          ],
          [
            { text: this.i18nService.getTranslation('menu.certificates', language) },
            { text: this.i18nService.getTranslation('menu.payment_history', language) },
          ],
          [
            { text: this.i18nService.getTranslation('menu.profile', language) },
            { text: this.i18nService.getTranslation('menu.language', language) },
          ],
          [
            { text: this.i18nService.getTranslation('menu.help', language) },
          ],
        ],
        resize_keyboard: true,
        persistent: true,
      },
    });
  }
}

  async sendMessageWithAdminMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [
            { text: this.i18nService.getTranslation('admin.user_stats', language) },
            { text: this.i18nService.getTranslation('admin.user_payments', language) },
          ],
          [
            { text: this.i18nService.getTranslation('admin.broadcast', language) },
            { text: this.i18nService.getTranslation('admin.user_panel', language) },
          ],
          [
            { text: this.i18nService.getTranslation('admin.manage_courses', language) },
            { text: this.i18nService.getTranslation('admin.manage_lessons', language) },
          ],
          [
            { text: this.i18nService.getTranslation('admin.manage_quizzes', language) },
            { text: this.i18nService.getTranslation('menu.profile', language) },
          ],
          [
            { text: this.i18nService.getTranslation('menu.language', language) },
            { text: this.i18nService.getTranslation('menu.help', language) },
          ],
        ],
        resize_keyboard: true,
        persistent: true,
      },
    });
  }

  async requestContact(chatId: number, telegramId: string) {
    await this.bot.sendMessage(chatId, this.i18nService.getTranslation('register.phone_request', 'uz'), {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: this.i18nService.getTranslation('register.share_phone', 'uz'), request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  async sendSticker(chatId: number, sticker: string) {
    await this.bot.sendSticker(chatId, sticker);
  }

  getBot(): TelegramBot {
    return this.bot;
  }

  setForceUserPanel(chatId: string, value: boolean): void {
    this.forcedUserPanelMap.set(chatId, value);
  }

  unsetForceUserPanel(chatId: string): void {
    this.forcedUserPanelMap.delete(chatId);
  }

  isUserPanelForced(chatId: string): boolean {
    return this.forcedUserPanelMap.get(chatId) ?? false;
  }
}