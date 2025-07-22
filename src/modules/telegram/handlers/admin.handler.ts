import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { AuthService } from '../../auth/auth.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { LessonService } from '../../lesson/lesson.service';
import { QuizService } from '../../quiz/quiz.service';
import { I18nService } from '../../i18n/i18n.service';
import { NotificationService } from '../../notification/notification.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class AdminHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly lessonService: LessonService,
    private readonly quizService: QuizService,
    private readonly i18nService: I18nService,
    private readonly notificationService: NotificationService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    const isAdmin = await this.authService.isAdmin(telegramId);
    if (!isAdmin) {
      const message = this.i18nService.getTranslation('errors.access_denied', language);
      await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
      return;
    }

    if (msg.text === '/admin') {
      await this.authService.setAdminMode(telegramId, true);
      const message = this.i18nService.getTranslation('admin.panel', language);
      await this.telegramService.sendMessageWithAdminMenu(chatId, message, language);
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.user_stats', language)) {
      try {
        const users = await this.userService.findAll();
        const totalUsers = users.length;
        const message = this.i18nService.getTranslation('stats.header', language) + '\n\n' +
                       this.i18nService.getTranslation('stats.total_users', language, { totalUsers: totalUsers.toString() }) + '\n\n' +
                       this.i18nService.getTranslation('stats.users_list', language) + '\n' +
                       (users.length > 0
                         ? users.map(user =>
                             this.i18nService.getTranslation('stats.user_info', language, {
                               id: user.telegramId,
                               name: user.fullName || 'N/A',
                               phone: user.phoneNumber || 'N/A',
                               email: user.email || 'N/A',
                             })
                           ).join('\n\n')
                         : this.i18nService.getTranslation('errors.user_not_found', language));
        await this.telegramService.sendMessageWithAdminMenu(chatId, message, language);
        return;
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.user_not_found', language);
        await this.telegramService.sendMessageWithAdminMenu(chatId, message, language);
        return;
      }
    } else if (msg.text === this.i18nService.getTranslation('admin.payment_history', language)) {
      const message = this.i18nService.getTranslation('admin.payment_history', language) + '\n' +
      await this.i18nService.getTranslation('errors.no_payment_history', language);
      await this.telegramService.sendMessageWithAdminMenu(chatId, message, language);
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.broadcast', language)) {
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.broadcast', language) + '\n' +
        this.i18nService.getTranslation('admin.enter_broadcast_message', language),
        {
          reply_markup: { force_reply: true },
        },
      );
      bot.once('message', async (reply) => {
        if (reply.chat.id === chatId) {
          try {
            await this.notificationService.broadcast(reply.text, { parse_mode: 'Markdown' });
            const message = this.i18nService.getTranslation('success.broadcast_sent', language);
            await this.telegramService.sendMessageWithAdminMenu(chatId, message, language);
          } catch (error) {
            const message = this.i18nService.getTranslation('errors.invalid_input', language);
            await this.telegramService.sendMessageWithAdminMenu(chatId, message, language);
          }
        }
      });
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.user_panel', language)) {
      await this.authService.setAdminMode(telegramId, false);
      const message = this.i18nService.getTranslation('menu.user_panel', language);
      await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.manage_courses', language)) {
      const message = this.i18nService.getTranslation('admin.manage_courses', language);
      await this.sendManageCoursesMenu(chatId, message, language);
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.manage_lessons', language)) {
      const message = this.i18nService.getTranslation('admin.manage_lessons', language);
      await this.sendManageLessonsMenu(chatId, message, language);
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.manage_quizzes', language)) {
      const message = this.i18nService.getTranslation('admin.manage_quizzes', language);
      await this.sendManageQuizzesMenu(chatId, message, language);
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.create_course', language)) {
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.create_course_prompt', language),
        { reply_markup: { force_reply: true } },
      );
      bot.once('message', async (reply) => {
        if (reply.chat.id === chatId) {
          try {
            const data = this.parseCourseInput(reply.text, language);
            const course = await this.courseService.createCourse({
              title: { uz: data.title_uz, ru: data.title_ru, en: data.title_en },
              description: { uz: data.desc_uz, ru: data.desc_ru, en: data.desc_en },
              isPaid: data.price > 0,
              price: data.price > 0 ? data.price : undefined,
            });
            const message = this.i18nService.getTranslation('success.course_created', language, { title: course.title[language] });
            await this.sendManageCoursesMenu(chatId, message, language);
          } catch (error) {
            const message = this.i18nService.getTranslation('errors.invalid_input', language);
            await this.sendManageCoursesMenu(chatId, message, language);
          }
        }
      });
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.view_courses', language)) {
      const courses = await this.courseService.findAll();
      const message = courses.length > 0
        ? this.i18nService.getTranslation('courses.list', language) + '\n\n' +
          courses.map((course, index) =>
            `${index + 1}. *${this.escapeMarkdown(course.title[language])}*\n` +
            `📝 ${this.escapeMarkdown(course.description[language])}\n` +
            `💰 ${course.isPaid ? `${course.price} UZS` : this.i18nService.getTranslation('courses.free', language)}`
          ).join('\n\n')
        : this.i18nService.getTranslation('courses.no_courses', language);
      await this.sendManageCoursesMenu(chatId, message, language);
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.delete_course', language)) {
      const courses = await this.courseService.findAll();
      if (!courses.length) {
        const message = this.i18nService.getTranslation('courses.no_courses', language);
        await this.sendManageCoursesMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: courses.map((course) => [
            { text: this.escapeMarkdown(course.title[language]), callback_data: `delete_course_${course.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.delete_course', language) + '\n' +
        this.i18nService.getTranslation('admin.select_course_to_delete', language),
        keyboard,
      );
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.create_lesson', language)) {
      const courses = await this.courseService.findAll();
      if (!courses.length) {
        const message = this.i18nService.getTranslation('courses.no_courses', language);
        await this.sendManageLessonsMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: courses.map((course) => [
            { text: this.escapeMarkdown(course.title[language]), callback_data: `create_lesson_course_${course.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.create_lesson', language) + '\n' +
        this.i18nService.getTranslation('admin.select_course_for_lesson', language),
        keyboard,
      );
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.view_lessons', language)) {
      const courses = await this.courseService.findAll();
      if (!courses.length) {
        const message = this.i18nService.getTranslation('courses.no_courses', language);
        await this.sendManageLessonsMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: courses.map((course) => [
            { text: this.escapeMarkdown(course.title[language]), callback_data: `view_lessons_course_${course.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.view_lessons', language) + '\n' +
        this.i18nService.getTranslation('admin.select_course_for_lessons', language),
        keyboard,
      );
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.delete_lesson', language)) {
      const courses = await this.courseService.findAll();
      if (!courses.length) {
        const message = this.i18nService.getTranslation('courses.no_courses', language);
        await this.sendManageLessonsMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: courses.map((course) => [
            { text: this.escapeMarkdown(course.title[language]), callback_data: `delete_lesson_course_${course.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.delete_lesson', language) + '\n' +
        this.i18nService.getTranslation('admin.select_course_to_delete_lesson', language),
        keyboard,
      );
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.create_quiz', language)) {
      const courses = await this.courseService.findAll();
      if (!courses.length) {
        const message = this.i18nService.getTranslation('courses.no_courses', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: courses.map((course) => [
            { text: this.escapeMarkdown(course.title[language]), callback_data: `create_quiz_course_${course.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.create_quiz', language) + '\n' +
        this.i18nService.getTranslation('admin.select_course_for_quiz', language),
        keyboard,
      );
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.view_quizzes', language)) {
      const courses = await this.courseService.findAll();
      if (!courses.length) {
        const message = this.i18nService.getTranslation('courses.no_courses', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: courses.map((course) => [
            { text: this.escapeMarkdown(course.title[language]), callback_data: `view_quizzes_course_${course.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.view_quizzes', language) + '\n' +
        this.i18nService.getTranslation('admin.select_course_for_quizzes', language),
        keyboard,
      );
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.delete_quiz', language)) {
      const courses = await this.courseService.findAll();
      if (!courses.length) {
        const message = this.i18nService.getTranslation('courses.no_courses', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: courses.map((course) => [
            { text: this.escapeMarkdown(course.title[language]), callback_data: `delete_quiz_course_${course.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.delete_quiz', language) + '\n' +
        this.i18nService.getTranslation('admin.select_course_to_delete_quiz', language),
        keyboard,
      );
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.back', language)) {
      const message = this.i18nService.getTranslation('admin.panel', language);
      await this.telegramService.sendMessageWithAdminMenu(chatId, message, language);
      return;
    }
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const data = query.data;

    if (data.startsWith('delete_course_')) {
      const courseId = parseInt(data.split('_')[2], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        const message = this.i18nService.getTranslation('errors.course_not_found', language);
        await this.sendManageCoursesMenu(chatId, message, language);
        return;
      }
      await this.courseService.deleteCourse(courseId);
      const message = this.i18nService.getTranslation('success.course_deleted', language, { title: this.escapeMarkdown(course.title[language]) });
      await this.sendManageCoursesMenu(chatId, message, language);
    } else if (data.startsWith('create_lesson_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        const message = this.i18nService.getTranslation('errors.course_not_found', language);
        await this.sendManageLessonsMenu(chatId, message, language);
        return;
      }
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.create_lesson_prompt', language),
        { reply_markup: { force_reply: true } },
      );
      bot.once('message', async (reply) => {
        if (reply.chat.id === chatId) {
          try {
            const data = this.parseLessonInput(reply.text, language);
            const lesson = await this.lessonService.createLesson({
              courseId,
              title: { uz: data.title_uz, ru: data.title_ru, en: data.title_en },
              contentType: data.contentType,
              contentUrl: data.contentUrl,
              order: data.order,
            });
            const message = this.i18nService.getTranslation('success.lesson_created', language, { title: this.escapeMarkdown(lesson.title[language]) });
            await this.sendManageLessonsMenu(chatId, message, language);
          } catch (error) {
            const message = this.i18nService.getTranslation('errors.invalid_input', language);
            await this.sendManageLessonsMenu(chatId, message, language);
          }
        }
      });
    } else if (data.startsWith('view_lessons_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const lessons = await this.lessonService.findByCourseId(courseId);
      const message = lessons.length > 0
        ? this.i18nService.getTranslation('lessons.list', language) + '\n\n' +
          lessons.map((lesson, index) =>
            `${index + 1}. *${this.escapeMarkdown(lesson.title[language])}*\n` +
            `📝 *${this.i18nService.getTranslation('lessons.type', language)}*: ${this.escapeMarkdown(lesson.contentType)}\n` +
            `🔗 *${this.i18nService.getTranslation('lessons.url', language)}*: ${this.escapeMarkdown(lesson.contentUrl)}\n` +
            `🔢 *${this.i18nService.getTranslation('lessons.order', language)}*: ${lesson.order}`
          ).join('\n\n')
        : this.i18nService.getTranslation('lessons.no_lessons', language);
      await this.sendManageLessonsMenu(chatId, message, language);
    } else if (data.startsWith('delete_lesson_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const lessons = await this.lessonService.findByCourseId(courseId);
      if (!lessons.length) {
        const message = this.i18nService.getTranslation('lessons.no_lessons', language);
        await this.sendManageLessonsMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: lessons.map((lesson) => [
            { text: this.escapeMarkdown(lesson.title[language]), callback_data: `delete_lesson_${lesson.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.delete_lesson', language) + '\n' +
        this.i18nService.getTranslation('admin.select_lesson_to_delete', language),
        keyboard,
      );
    } else if (data.startsWith('delete_lesson_')) {
      const lessonId = parseInt(data.split('_')[2], 10);
      const lesson = await this.lessonService.findById(lessonId);
      if (!lesson) {
        const message = this.i18nService.getTranslation('errors.lesson_not_found', language);
        await this.sendManageLessonsMenu(chatId, message, language);
        return;
      }
      await this.lessonService.deleteLesson(lessonId);
      const message = this.i18nService.getTranslation('success.lesson_deleted', language, { title: this.escapeMarkdown(lesson.title[language]) });
      await this.sendManageLessonsMenu(chatId, message, language);
    } else if (data.startsWith('create_quiz_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        const message = this.i18nService.getTranslation('errors.course_not_found', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.create_quiz_prompt', language),
        { reply_markup: { force_reply: true } },
      );
      bot.once('message', async (reply) => {
        if (reply.chat.id === chatId) {
          try {
            const data = this.parseQuizInput(reply.text, language);
            const quiz = await this.quizService.createQuiz({
              courseId,
              question: { uz: data.question_uz, ru: data.question_ru, en: data.question_en },
              options: {
                uz: data.options_uz.split(',').map(s => s.trim()),
                ru: data.options_ru.split(',').map(s => s.trim()),
                en: data.options_en.split(',').map(s => s.trim()),
              },
              correctAnswer: data.correctAnswer,
            });
            const message = this.i18nService.getTranslation('success.quiz_created', language, { question: this.escapeMarkdown(quiz.question[language]) });
            await this.sendManageQuizzesMenu(chatId, message, language);
          } catch (error) {
            const message = this.i18nService.getTranslation('errors.invalid_input', language);
            await this.sendManageQuizzesMenu(chatId, message, language);
          }
        }
      });
    } else if (data.startsWith('view_quizzes_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        const message = this.i18nService.getTranslation('errors.course_not_found', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      const quizzes = await this.quizService.findByCourseId(courseId);
      if (!quizzes.length) {
  const message = this.i18nService.getTranslation('quizzes.no_quizzes', language);
  await this.sendManageQuizzesMenu(chatId, message, language);
  return;
}

const messages: string[] = [];
let currentMessage: string = this.i18nService.getTranslation('quizzes.list', language) + '\n\n';

for (const [index, quiz] of quizzes.entries()) {
  const questionText = this.escapeMarkdown(quiz.question[language]);
  const options = quiz.options as Record<string, string[]>;
  const formattedOptions = options[language].map(opt => this.escapeMarkdown(opt)).join(', ');
  const correctAnswer = this.escapeMarkdown(options[language][quiz.correctAnswer]);

  const quizText = `${index + 1}. *${questionText}*\n` +
                   `📝 *Variantlar:* ${formattedOptions}\n` +
                   `✅ *To‘g‘ri javob:* ${correctAnswer}`;

  if ((currentMessage + quizText + '\n\n').length > 4000) {
    messages.push(currentMessage);
    currentMessage = '';
  }

  currentMessage += quizText + '\n\n';
}

if (currentMessage) {
  messages.push(currentMessage);
}

for (const message of messages) {
  await this.sendManageQuizzesMenu(chatId, message, language);
}

    } else if (data.startsWith('delete_quiz_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const quizzes = await this.quizService.findByCourseId(courseId);
      if (!quizzes.length) {
        const message = this.i18nService.getTranslation('quizzes.no_quizzes', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      const keyboard = {
        reply_markup: {
          inline_keyboard: quizzes.map((quiz) => [
            { text: this.escapeMarkdown(quiz.question[language]), callback_data: `delete_quiz_${quiz.id}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.delete_quiz', language) + '\n' +
        this.i18nService.getTranslation('admin.select_quiz_to_delete', language),
        keyboard,
      );
    } else if (data.startsWith('delete_quiz_')) {
      const quizId = parseInt(data.split('_')[2], 10);
      const quiz = await this.quizService.findById(quizId);
      if (!quiz) {
        const message = this.i18nService.getTranslation('errors.quiz_not_found', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      await this.quizService.deleteQuiz(quizId);
      const message = this.i18nService.getTranslation('success.quiz_deleted', language, { question: this.escapeMarkdown(quiz.question[language]) });
      await this.sendManageQuizzesMenu(chatId, message, language);
    }
    await bot.answerCallbackQuery(query.id);
  }

  private async sendManageCoursesMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [
            { text: this.i18nService.getTranslation('admin.create_course', language) },
            { text: this.i18nService.getTranslation('admin.view_courses', language) },
          ],
          [
            { text: this.i18nService.getTranslation('admin.delete_course', language) },
            { text: this.i18nService.getTranslation('admin.back', language) },
          ],
        ],
        resize_keyboard: true,
        persistent: true,
      },
    });
  }

  private async sendManageLessonsMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [
            { text: this.i18nService.getTranslation('admin.create_lesson', language) },
            { text: this.i18nService.getTranslation('admin.view_lessons', language) },
          ],
          [
            { text: this.i18nService.getTranslation('admin.delete_lesson', language) },
            { text: this.i18nService.getTranslation('admin.back', language) },
          ],
        ],
        resize_keyboard: true,
        persistent: true,
      },
    });
  }

  private async sendManageQuizzesMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [
            { text: this.i18nService.getTranslation('admin.create_quiz', language) },
            { text: this.i18nService.getTranslation('admin.view_quizzes', language) },
          ],
          [
            { text: this.i18nService.getTranslation('admin.delete_quiz', language) },
            { text: this.i18nService.getTranslation('admin.back', language) },
          ],
        ],
        resize_keyboard: true,
        persistent: true,
      },
    });
  }

  private parseCourseInput(input: string, language: string): any {
    const lines = input.split('\n').map(line => line.trim());
    const expectedFormat = [
      'Kurs nomi uz', 'Kurs nomi ru', 'Kurs nomi en',
      'Ta’rif uz', 'Ta’rif ru', 'Ta’rif en', 'Narx',
    ];
    if (lines.length < expectedFormat.length) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    const data: any = {};
    lines.forEach(line => {
      if (line.startsWith('Kurs nomi uz:')) data.title_uz = line.replace('Kurs nomi uz:', '').trim();
      if (line.startsWith('Kurs nomi ru:')) data.title_ru = line.replace('Kurs nomi ru:', '').trim();
      if (line.startsWith('Kurs nomi en:')) data.title_en = line.replace('Kurs nomi en:', '').trim();
      if (line.startsWith('Ta’rif uz:')) data.desc_uz = line.replace('Ta’rif uz:', '').trim();
      if (line.startsWith('Ta’rif ru:')) data.desc_ru = line.replace('Ta’rif ru:', '').trim();
      if (line.startsWith('Ta’rif en:')) data.desc_en = line.replace('Ta’rif en:', '').trim();
      if (line.startsWith('Narx:')) data.price = parseInt(line.replace('Narx:', '').trim(), 10);
    });
    if (!data.title_uz || !data.title_ru || !data.title_en || !data.desc_uz || !data.desc_ru || !data.desc_en || isNaN(data.price)) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    return data;
  }

  private parseLessonInput(input: string, language: string): any {
    const lines = input.split('\n').map(line => line.trim());
    const expectedFormat = [
      'Dars nomi uz', 'Dars nomi ru', 'Dars nomi en',
      'Kontent turi', 'Kontent havolasi', 'Tartib',
    ];
    if (lines.length < expectedFormat.length) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    const data: any = {};
    lines.forEach(line => {
      if (line.startsWith('Dars nomi uz:')) data.title_uz = line.replace('Dars nomi uz:', '').trim();
      if (line.startsWith('Dars nomi ru:')) data.title_ru = line.replace('Dars nomi ru:', '').trim();
      if (line.startsWith('Dars nomi en:')) data.title_en = line.replace('Dars nomi en:', '').trim();
      if (line.startsWith('Kontent turi:')) data.contentType = line.replace('Kontent turi:', '').trim();
      if (line.startsWith('Kontent havolasi:')) data.contentUrl = line.replace('Kontent havolasi:', '').trim();
      if (line.startsWith('Tartib:')) data.order = parseInt(line.replace('Tartib:', '').trim(), 10);
    });
    if (!data.title_uz || !data.title_ru || !data.title_en || !data.contentType || !data.contentUrl || isNaN(data.order)) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    return data;
  }

  private parseQuizInput(input: string, language: string): any {
    const lines = input.split('\n').map(line => line.trim());
    const expectedFormat = [
      'Savol uz', 'Savol ru', 'Savol en',
      'Variantlar uz', 'Variantlar ru', 'Variantlar en',
      'To‘g‘ri javob',
    ];
    if (lines.length < expectedFormat.length) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    const data: any = {};
    lines.forEach(line => {
      if (line.startsWith('Savol uz:')) data.question_uz = line.replace('Savol uz:', '').trim();
      if (line.startsWith('Savol ru:')) data.question_ru = line.replace('Savol ru:', '').trim();
      if (line.startsWith('Savol en:')) data.question_en = line.replace('Savol en:', '').trim();
      if (line.startsWith('Variantlar uz:')) data.options_uz = line.replace('Variantlar uz:', '').trim();
      if (line.startsWith('Variantlar ru:')) data.options_ru = line.replace('Variantlar ru:', '').trim();
      if (line.startsWith('Variantlar en:')) data.options_en = line.replace('Variantlar en:', '').trim();
      if (line.startsWith('To‘g‘ri javob:')) data.correctAnswer = parseInt(line.replace('To‘g‘ri javob:', '').trim(), 10);
    });
    if (
      !data.question_uz || !data.question_ru || !data.question_en ||
      !data.options_uz || !data.options_ru || !data.options_en ||
      isNaN(data.correctAnswer) || data.correctAnswer < 0 || data.correctAnswer > 3
    ) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    return data;
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+-=|{}.!])/g, '\\$1');
  }
}