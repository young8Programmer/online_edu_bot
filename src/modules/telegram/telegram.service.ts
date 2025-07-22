import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as TelegramBot from 'node-telegram-bot-api';
import { I18nService } from '../i18n/i18n.service';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import { ModuleRef } from '@nestjs/core';
import { telegramConfig } from '../../config/telegram.config';
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
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    try {
      const config = telegramConfig(this.configService);
      this.bot = new TelegramBot(config.botToken, { polling: true });
      this.logger.log(`Telegram bot initialized with token: ${config.botToken.slice(0, 5)}...`);

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

      // Buyruqlar
      this.bot.onText(/\/start/, (msg) => {
        this.logger.log(`Received /start command from telegramId: ${msg.from.id}`);
        startHandler.handle(msg, this.bot);
      });
      this.bot.onText(/\/help/, (msg) => {
        this.logger.log(`Received /help command from telegramId: ${msg.from.id}`);
        helpHandler.handle(msg, this.bot);
      });
      this.bot.onText(/\/admin/, (msg) => {
        this.logger.log(`Received /admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/\/register/, (msg) => {
        this.logger.log(`Received /register command from telegramId: ${msg.from.id}`);
        registerHandler.handle(msg, this.bot);
      });
      this.bot.onText(/\/profile/, (msg) => {
        this.logger.log(`Received /profile command from telegramId: ${msg.from.id}`);
        profileHandler.handle(msg, this.bot);
      });
      this.bot.onText(/\/language/, (msg) => {
        this.logger.log(`Received /language command from telegramId: ${msg.from.id}`);
        languageHandler.handle(msg, this.bot);
      });

      // Menyu tugmalari
      this.bot.onText(/🌐 Tilni tanlash|🌐 Смена языка|🌐 Change language/, (msg) => {
        this.logger.log(`Received language menu command from telegramId: ${msg.from.id}, text: ${msg.text}`);
        languageHandler.handle(msg, this.bot);
      });
      this.bot.onText(/👤 Profil|👤 Профиль|👤 Profile/, (msg) => {
        this.logger.log(`Received profile menu command from telegramId: ${msg.from.id}`);
        profileHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🎓 Kurslar|🎓 Курсы|🎓 Courses/, (msg) => {
        this.logger.log(`Received courses menu command from telegramId: ${msg.from.id}`);
        listCoursesHandler.handle(msg, this.bot);
      });
      this.bot.onText(/📊 Progress|📊 Прогресс|📊 Progress/, (msg) => {
        this.logger.log(`Received progress menu command from telegramId: ${msg.from.id}`);
        viewProgressHandler.handle(msg, this.bot);
      });
      this.bot.onText(/📝 Test\/Quiz|📝 Тест\/Квиз|📝 Test\/Quiz/, (msg) => {
        this.logger.log(`Received quiz menu command from telegramId: ${msg.from.id}`);
        startQuizHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🎖️ Sertifikatlar|🎖️ Сертификаты|🎖️ Certificates/, (msg) => {
        this.logger.log(`Received certificates menu command from telegramId: ${msg.from.id}`);
        viewCertificatesHandler.handle(msg, this.bot);
      });
      this.bot.onText(/💳 To‘lov|💳 Оплата|💳 Payment/, (msg) => {
        this.logger.log(`Received payment menu command from telegramId: ${msg.from.id}`);
        paymentHistoryHandler.handle(msg, this.bot);
      });
      this.bot.onText(/ℹ️ Yordam|ℹ️ Помощь|ℹ️ Help/, (msg) => {
        this.logger.log(`Received help menu command from telegramId: ${msg.from.id}`);
        helpHandler.handle(msg, this.bot);
      });

      // Admin tugmalari
      this.bot.onText(/📊 Foydalanuvchi statistikasi|📊 Статистика пользователей|📊 User stats/, (msg) => {
        this.logger.log(`Received user stats admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/💸 To‘lovlar tarixi|💸 История платежей|💸 Payment history/, (msg) => {
        this.logger.log(`Received payment history admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/📢 Xabar yuborish|📢 Отправить сообщение|📢 Send broadcast/, (msg) => {
        this.logger.log(`Received broadcast admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/📋 Foydalanuvchi paneli|📋 Пользовательская панель|📋 User panel/, (msg) => {
        this.logger.log(`Received user panel admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/📚 Kurslarni boshqarish|📚 Управление курсами|📚 Manage courses/, (msg) => {
        this.logger.log(`Received manage courses admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/📖 Darslarni boshqarish|📖 Управление уроками|📖 Manage lessons/, (msg) => {
        this.logger.log(`Received manage lessons admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/📝 Testlarni boshqarish|📝 Управление тестами|📝 Manage quizzes/, (msg) => {
        this.logger.log(`Received manage quizzes admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/➕ Kurs yaratish|➕ Создать курс|➕ Create course/, (msg) => {
        this.logger.log(`Received create course admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🔍 Kurslarni ko‘rish|🔍 Посмотреть курсы|🔍 View courses/, (msg) => {
        this.logger.log(`Received view courses admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🗑 Kursni o‘chirish|🗑 Удалить курс|🗑 Delete course/, (msg) => {
        this.logger.log(`Received delete course admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/➕ Dars yaratish|➕ Создать урок|➕ Create lesson/, (msg) => {
        this.logger.log(`Received create lesson admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🔍 Darslarni ko‘rish|🔍 Посмотреть уроки|🔍 View lessons/, (msg) => {
        this.logger.log(`Received view lessons admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🗑 Darsni o‘chirish|🗑 Удалить урок|🗑 Delete lesson/, (msg) => {
        this.logger.log(`Received delete lesson admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/➕ Test yaratish|➕ Создать тест|➕ Create quiz/, (msg) => {
        this.logger.log(`Received create quiz admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🔍 Testlarni ko‘rish|🔍 Посмотреть тесты|🔍 View quizzes/, (msg) => {
        this.logger.log(`Received view quizzes admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🗑 Testni o‘chirish|🗑 Удалить тест|🗑 Delete quiz/, (msg) => {
        this.logger.log(`Received delete quiz admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });
      this.bot.onText(/🔙 Orqaga|🔙 Назад|🔙 Back/, (msg) => {
        this.logger.log(`Received back admin command from telegramId: ${msg.from.id}`);
        adminHandler.handle(msg, this.bot);
      });

      // Callback query hodisasi
      this.bot.on('callback_query', (query) => {
        this.logger.log(`Received callback_query: queryId=${query.id}, from=${query.from.id}, data=${query.data}, chatId=${query.message?.chat.id}`);
        callbackHandler.handle(query, this.bot);
      });

      this.bot.on('contact', (msg) => {
        this.logger.log(`Received contact from telegramId: ${msg.from.id}`);
        registerHandler.handle(msg, this.bot);
      });

      this.bot.on('message', async (msg) => {
        this.logger.log(`Received message from telegramId: ${msg.from.id}, text: ${msg.text}`);
        const user = await this.userService.findByTelegramId(msg.from.id.toString());
        const language = user?.language || 'uz';
        if (msg.text && !msg.contact && !msg.text.startsWith('/') && !this.isMenuCommand(msg.text, language)) {
          this.logger.log(`Forwarding non-command message to RegisterHandler: ${msg.text}`);
          await registerHandler.handle(msg, this.bot);
        }
      });

      this.bot.on('polling_error', (error) => {
        this.logger.error(`Polling error: ${error.message}, stack: ${error.stack}`);
      });

      this.logger.log('TelegramService fully initialized');
    } catch (error) {
      this.logger.error(`Error in onModuleInit: ${error.message}, stack: ${error.stack}`);
      throw error;
    }
  }

  private isMenuCommand(text: string, language: string): boolean {
    const menuCommands = [
      this.i18nService.getTranslation('menu.courses', language),
      this.i18nService.getTranslation('menu.progress', language),
      this.i18nService.getTranslation('menu.quiz', language),
      this.i18nService.getTranslation('menu.certificates', language),
      this.i18nService.getTranslation('menu.payment', language),
      this.i18nService.getTranslation('menu.profile', language),
      this.i18nService.getTranslation('menu.language', language),
      this.i18nService.getTranslation('menu.help', language),
      this.i18nService.getTranslation('admin.user_stats', language),
      this.i18nService.getTranslation('admin.payment_history', language),
      this.i18nService.getTranslation('admin.broadcast', language),
      this.i18nService.getTranslation('admin.user_panel', language),
      this.i18nService.getTranslation('admin.manage_courses', language),
      this.i18nService.getTranslation('admin.manage_lessons', language),
      this.i18nService.getTranslation('admin.manage_quizzes', language),
      this.i18nService.getTranslation('admin.create_course', language),
      this.i18nService.getTranslation('admin.view_courses', language),
      this.i18nService.getTranslation('admin.delete_course', language),
      this.i18nService.getTranslation('admin.create_lesson', language),
      this.i18nService.getTranslation('admin.view_lessons', language),
      this.i18nService.getTranslation('admin.delete_lesson', language),
      this.i18nService.getTranslation('admin.create_quiz', language),
      this.i18nService.getTranslation('admin.view_quizzes', language),
      this.i18nService.getTranslation('admin.delete_quiz', language),
      this.i18nService.getTranslation('admin.back', language),
    ];
    const isCommand = menuCommands.includes(text);
    this.logger.log(`Checking if text is menu command: text=${text}, language=${language}, isCommand=${isCommand}`);
    return isCommand;
  }

  async sendMessage(chatId: number, message: string, options?: any): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...options });
      this.logger.log(`Message sent to ${chatId}: ${message}`);
    } catch (error) {
      this.logger.error(`Error sending message to ${chatId}: ${error.message}, stack: ${error.stack}`);
      throw error;
    }
  }

  async sendMessageWithMenu(chatId: number, message: string, language: string, telegramId: string): Promise<void> {
    try {
      const isAdmin = await this.authService.isAdmin(telegramId);
      const isAdminMode = await this.authService.isAdminMode(telegramId);

      if (isAdmin && isAdminMode) {
        await this.sendMessageWithAdminMenu(chatId, message, language);
      } else {
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [
                { text: this.i18nService.getTranslation('menu.courses', language) },
                { text: this.i18nService.getTranslation('menu.progress', language) },
              ],
              [
                { text: this.i18nService.getTranslation('menu.quiz', language) },
                { text: this.i18nService.getTranslation('menu.certificates', language) },
              ],
              [
                { text: this.i18nService.getTranslation('menu.payment', language) },
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
        this.logger.log(`Message with user menu sent to ${chatId}: ${message}`);
      }
    } catch (error) {
      this.logger.error(`Error sending message with menu to ${chatId}: ${error.message}, stack: ${error.stack}`);
      throw error;
    }
  }

  async sendMessageWithAdminMenu(chatId: number, message: string, language: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [
              { text: this.i18nService.getTranslation('admin.user_stats', language) },
              { text: this.i18nService.getTranslation('admin.payment_history', language) },
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
      this.logger.log(`Message with admin menu sent to ${chatId}: ${message}`);
    } catch (error) {
      this.logger.error(`Error sending message with admin menu to ${chatId}: ${error.message}, stack: ${error.stack}`);
      throw error;
    }
  }

  async sendSticker(chatId: number, sticker: string) {
    try {
      await this.bot.sendSticker(chatId, sticker);
      this.logger.log(`Sticker sent to ${chatId}`);
    } catch (error) {
      this.logger.error(`Error sending sticker to ${chatId}: ${error.message}, stack: ${error.stack}`);
      throw error;
    }
  }

  getBot(): TelegramBot {
    return this.bot;
  }
}