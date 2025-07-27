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
import { GeneralQuizHandler } from '../quiz/handlers/general-quiz.handler';
import { MixedQuizHandler } from '../quiz/handlers/mixed-quiz.handler';
import { ViewCertificatesHandler } from '../certificate/handlers/view-certificate.handler';
import { PaymentHistoryHandler } from '../payment/handlers/payment-history.handler';
import { QuizService } from '../quiz/quiz.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: TelegramBot;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly quizService: QuizService,
    private readonly moduleRef: ModuleRef,
    @Inject('FORCED_USER_PANEL_MAP')
    private forcedUserPanelMap: Map<string, boolean>,
  ) {}

  async onModuleInit() {
    const config = telegramConfig(this.configService);
    this.bot = new TelegramBot(config.botToken, { polling: true });

    const handlers = {
      start: this.moduleRef.get(StartHandler, { strict: false }),
      help: this.moduleRef.get(HelpHandler, { strict: false }),
      admin: this.moduleRef.get(AdminHandler, { strict: false }),
      callback: this.moduleRef.get(CallbackHandler, { strict: false }),
      register: this.moduleRef.get(RegisterHandler, { strict: false }),
      language: this.moduleRef.get(LanguageHandler, { strict: false }),
      profile: this.moduleRef.get(ProfileHandler, { strict: false }),
      listCourses: this.moduleRef.get(ListCoursesHandler, { strict: false }),
      viewProgress: this.moduleRef.get(ViewProgressHandler, { strict: false }),
      startQuiz: this.moduleRef.get(StartQuizHandler, { strict: false }),
      generalQuiz: this.moduleRef.get(GeneralQuizHandler, { strict: false }),
      mixedQuiz: this.moduleRef.get(MixedQuizHandler, { strict: false }),
      viewCertificates: this.moduleRef.get(ViewCertificatesHandler, { strict: false }),
      paymentHistory: this.moduleRef.get(PaymentHistoryHandler, { strict: false }),
    };

    this.bot.onText(/^\/start$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      try {
        if (!user) {
          const defaultMessage = 'Iltimos, tilni tanlang:\\n🇺🇿 O‘zbek\\n🇷🇺 Русский\\n🇬🇧 English';
          const languageRequest = this.i18nService.getTranslation('register.language_request', 'uz') || defaultMessage;
          await this.bot.sendMessage(msg.chat.id, this.escapeMarkdown(languageRequest), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🇺🇿 O‘zbek', callback_data: 'lang_uz' },
                  { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
                  { text: '🇬🇧 English', callback_data: 'lang_en' },
                ],
              ],
            },
          });
        } else {
          const language = user.language || 'uz';
          const message = this.i18nService.getTranslation('welcome.message', language, { name: user.fullName || 'Foydalanuvchi' });
          await this.sendMessageWithMenu(msg.chat.id, message, language, telegramId, false, user);
        }
      } catch (error) {
        await this.bot.sendMessage(msg.chat.id, this.escapeMarkdown('Server xatosi yuz berdi\\.'), { parse_mode: 'MarkdownV2' });
      }
    });

    this.bot.onText(/^\/help$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      await handlers.help.handle(msg, this.bot, this.sendMessageWithMenu.bind(this));
    });

    this.bot.onText(/^\/register$/, async (msg) => {
      await handlers.register.handle(msg, this.bot);
    });

    this.bot.onText(/^\/language$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      await handlers.language.handle(msg, this.bot, this.sendMessageWithMenu.bind(this));
    });

    this.bot.onText(/^\/profile$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      await handlers.profile.handle(msg, this.bot, this.sendMessageWithMenu.bind(this));
    });

    this.bot.onText(/^\/admin$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      try {
        if (await this.authService.isAdmin(telegramId)) {
          this.forcedUserPanelMap.delete(String(msg.chat.id));
          const message = this.i18nService.getTranslation('admin.panel', language) || 'Admin paneli';
          await this.sendMessageWithAdminMenu(msg.chat.id, message, language);
        } else {
          const message = this.i18nService.getTranslation('errors.access_denied', language) || 'Ruxsat yo‘q';
          await this.sendMessageWithMenu(msg.chat.id, message, language, telegramId);
        }
      } catch (error) {
        await this.bot.sendMessage(msg.chat.id, this.escapeMarkdown('Server xatosi yuz berdi\\.'), { parse_mode: 'MarkdownV2' });
      }
    });

    this.bot.onText(/^🎓\s*(Kurslar|Courses)$/, async (msg) => {
      await handlers.listCourses.handle(msg, this.bot);
    });

    this.bot.onText(/^📊\s*(Progress)$/, async (msg) => {
      await handlers.viewProgress.handle(msg, this.bot);
    });

    this.bot.onText(/^🧪\s*(Testlar|Quizzes)$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      const chatId = msg.chat.id;
      try {
        const quizzes = await this.quizService.findGeneralQuizzes();
        if (!quizzes.length) {
          const noQuizzesMessage = this.i18nService.getTranslation('quizzes.no_quizzes', language) || 'Hozirda testlar mavjud emas\\.';
          await this.sendMessageWithMenu(chatId, noQuizzesMessage, language, telegramId);
          return;
        }

        const keyboard = {
          reply_markup: {
            inline_keyboard: quizzes
              .map((quiz) => [
                {
                  text: this.escapeMarkdown(quiz.questions[0]?.question[language] || 'No question'),
                  callback_data: `start_general_quiz_${quiz.id}`,
                },
              ])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language) || '🔙 Orqaga'), callback_data: 'back_to_menu' }]]),
          },
        };
        await this.bot.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('quizzes.list', language) || 'Testlar ro‘yxati'),
          {
            parse_mode: 'MarkdownV2',
            ...keyboard,
          },
        );
      } catch (error) {
        await this.sendMessageWithMenu(chatId, this.escapeMarkdown('Testlarni olishda xato yuz berdi\\.'), language, telegramId);
      }
    });

    this.bot.onText(/^🎖️\s*(Sertifikatlar|Certificates)$/, async (msg) => {
      await handlers.viewCertificates.handle(msg, this.bot);
    });

    this.bot.onText(/^📂\s*(To‘lovlar\s+tarixi|Payment history)$/, async (msg) => {
      await handlers.paymentHistory.handle(msg, this.bot);
    });

    this.bot.onText(/^👤\s*(Profil|Profile)$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      await handlers.profile.handle(msg, this.bot, this.sendMessageWithMenu.bind(this));
    });

    this.bot.onText(/^🌐\s*(Tilni\s+tanlash|Language)$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      await handlers.language.handle(msg, this.bot, this.sendMessageWithMenu.bind(this));
    });

    this.bot.onText(/^ℹ️\s*(Yordam|Help)$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      await handlers.help.handle(msg, this.bot, this.sendMessageWithMenu.bind(this));
    });

    this.bot.onText(/^📋\s*(Foydalanuvchi paneli|User panel)$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      try {
        this.forcedUserPanelMap.set(String(msg.chat.id), true);
        const message = this.i18nService.getTranslation('welcome.message', language, { name: user?.fullName || 'Foydalanuvchi' });
        await this.sendMessageWithMenu(msg.chat.id, message, language, telegramId, true);
      } catch (error) {
        await this.bot.sendMessage(msg.chat.id, this.escapeMarkdown('Server xatosi yuz berdi\\.'), { parse_mode: 'MarkdownV2' });
      }
    });

    this.bot.onText(/^📊\s*(Foydalanuvchi statistikasi|User statistics)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^💸\s*(Foydalanuvchilar to‘lovlari|User payments)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^📢\s*(Xabar yuborish|Broadcast)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^📚\s*(Kurslarni boshqarish|Manage courses)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^📖\s*(Darslarni boshqarish|Manage lessons)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^📝\s*(Testlarni boshqarish|Manage quizzes)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^➕\s*(Yangi kurs|New course)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^🔍\s*(Testlarni ko‘rish|View quizzes)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^🗑\s*(O‘chirish|Delete)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^📚\s*(Kurslarni ko‘rish|View courses|Курсы)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^📖\s*(Darslarni ko‘rish|View lessons|Уроки)$/, async (msg) => {
      await handlers.admin.handle(msg, this.bot);
    });

    this.bot.onText(/^🧪\s*(Aralash testlar|Mixed quizzes)$/, async (msg) => {
      await handlers.mixedQuiz.handle(msg, this.bot);
    });

    this.bot.onText(/^🔙\s*(Orqaga|Back|Назад)$/, async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      try {
        if (await this.authService.isAdmin(telegramId) && !this.forcedUserPanelMap.get(String(msg.chat.id))) {
          const message = this.i18nService.getTranslation('admin.panel', language) || 'Admin paneli';
          await this.sendMessageWithAdminMenu(msg.chat.id, message, language);
        } else {
          const message = this.i18nService.getTranslation('welcome.message', language, { name: user?.fullName || 'Foydalanuvchi' });
          await this.sendMessageWithMenu(msg.chat.id, message, language, telegramId);
        }
      } catch (error) {
        await this.bot.sendMessage(msg.chat.id, this.escapeMarkdown('Server xatosi yuz berdi\\.'), { parse_mode: 'MarkdownV2' });
      }
    });

    this.bot.on('callback_query', async (query) => {
      await handlers.callback.handle(query, this.bot, this.sendMessageWithAdminMenu.bind(this), this.sendMessageWithMenu.bind(this));
    });

    this.bot.on('contact', async (msg) => {
      await handlers.register.handle(msg, this.bot);
    });

    this.bot.on('message', async (msg) => {
      const telegramId = BigInt(msg.from.id).toString();
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language || 'uz';
      if (msg.text && !msg.contact && !msg.text.startsWith('/') && !this.isMenuCommand(msg.text, language)) {
        await handlers.register.handle(msg, this.bot);
        await handlers.mixedQuiz.handle(msg, this.bot);
      }
    });
  }

  private isMenuCommand(text: string, language: string): boolean {
    const keys = [
      'menu.courses', 'menu.progress', 'menu.quizzes',
      'menu.certificates', 'menu.payment_history', 'menu.profile', 'menu.language',
      'menu.help', 'menu.back',
      'admin.user_stats', 'admin.user_payments', 'admin.broadcast',
      'admin.user_panel', 'admin.manage_courses', 'admin.manage_lessons',
      'admin.manage_quizzes', 'admin.create_course', 'admin.view_courses',
      'admin.delete_course', 'admin.create_lesson', 'admin.view_lessons',
      'admin.delete_lesson', 'admin.create_quiz', 'admin.view_quizzes',
      'admin.delete_quiz', 'admin.back',
      'quizzes.mixed_quizzes',
    ];
    const cleanedText = text.replace(/\\/g, '').replace(/\s+/g, ' ').trim();
    const translations = keys
      .map((key) => this.i18nService.getTranslation(key, language))
      .filter(Boolean)
      .map((t) => t.replace(/\\/g, '').replace(/\s+/g, ' ').trim());
    return translations.includes(cleanedText);
  }

async sendMessage(chatId: number, message: string, options?: TelegramBot.SendMessageOptions): Promise<void> {
  await this.bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...options });
}


  async sendMessageWithMenu(
    chatId: number,
    message: string,
    language: string,
    telegramId: string,
    forceUserPanel = false,
    user?: any,
  ): Promise<void> {
    const isAdmin = await this.authService.isAdmin(telegramId);
    if (forceUserPanel) {
      this.forcedUserPanelMap.set(String(chatId), true);
    }
    const hasForcedUserPanel = this.forcedUserPanelMap.get(String(chatId));
    const finalMessage = user
      ? this.escapeMarkdown(message.replace('{name}', this.escapeMarkdown(user.fullName || 'Foydalanuvchi')))
      : this.escapeMarkdown(message);

    const menuButtons = [
      [
        { text: this.i18nService.getTranslation('menu.courses', language) || '🎓 Kurslar' },
        { text: this.i18nService.getTranslation('menu.progress', language) || '📊 Progress' },
      ],
      [
        { text: this.i18nService.getTranslation('menu.quizzes', language) || '🧪 Testlar' },
        { text: this.i18nService.getTranslation('menu.certificates', language) || '🎖️ Sertifikatlar' },
      ],
      [
        { text: this.i18nService.getTranslation('menu.payment_history', language) || '📂 To‘lovlar tarixi' },
        { text: this.i18nService.getTranslation('menu.profile', language) || '👤 Profil' },
      ],
      [
        { text: this.i18nService.getTranslation('menu.language', language) || '🌐 Tilni tanlash' },
        { text: this.i18nService.getTranslation('menu.help', language) || 'ℹ️ Yordam' },
      ],
    ];

    if (isAdmin && !hasForcedUserPanel) {
      await this.sendMessageWithAdminMenu(chatId, finalMessage, language);
    } else {
      await this.bot.sendMessage(chatId, finalMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          keyboard: menuButtons,
          resize_keyboard: true,
          persistent: true,
        },
      });
    }
  }

  async sendMessageWithAdminMenu(chatId: number, message: string, language: string): Promise<void> {
    const adminMenuButtons = [
      [
        { text: this.i18nService.getTranslation('admin.user_stats', language) || '📊 Foydalanuvchi statistikasi' },
        { text: this.i18nService.getTranslation('admin.user_payments', language) || '💸 Foydalanuvchilar to‘lovlari' },
      ],
      [
        { text: this.i18nService.getTranslation('admin.broadcast', language) || '📢 Xabar yuborish' },
        { text: this.i18nService.getTranslation('admin.user_panel', language) || '📋 Foydalanuvchi paneli' },
      ],
      [
        { text: this.i18nService.getTranslation('admin.manage_courses', language) || '📚 Kurslarni boshqarish' },
        { text: this.i18nService.getTranslation('admin.manage_lessons', language) || '📖 Darslarni boshqarish' },
      ],
      [
        { text: this.i18nService.getTranslation('admin.manage_quizzes', language) || '📝 Testlarni boshqarish' },
        { text: this.i18nService.getTranslation('quizzes.mixed_quizzes', language) || '🧪 Aralash testlar' },
      ],
      [
        { text: this.i18nService.getTranslation('menu.profile', language) || '👤 Profil' },
        { text: this.i18nService.getTranslation('menu.language', language) || '🌐 Tilni tanlash' },
      ],
      [
        { text: this.i18nService.getTranslation('menu.help', language) || 'ℹ️ Yordam' },
        { text: this.i18nService.getTranslation('menu.back', language) || '🔙 Orqaga' },
      ],
    ];

    await this.bot.sendMessage(chatId, this.escapeMarkdown(message), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        keyboard: adminMenuButtons,
        resize_keyboard: true,
        persistent: true,
      },
    });
  }

  async requestContact(chatId: number, telegramId: string) {
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language || 'uz';
    const phoneRequest = this.i18nService.getTranslation('register.phone_request', language) || 'Iltimos, telefon raqamingizni yuboring';
    await this.bot.sendMessage(chatId, this.escapeMarkdown(phoneRequest), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        keyboard: [
          [{ text: this.i18nService.getTranslation('register.share_phone', language) || 'Telefon raqamni yuborish', request_contact: true }],
          [{ text: this.i18nService.getTranslation('menu.back', language) || '🔙 Orqaga' }],
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

    escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }
}