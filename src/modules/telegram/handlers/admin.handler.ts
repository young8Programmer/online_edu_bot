import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { AuthService } from '../../auth/auth.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { LessonService } from '../../lesson/lesson.service';
import { QuizService } from '../../quiz/quiz.service';
import { I18nService } from '../../i18n/i18n.service';
import { NotificationService } from '../../notification/notification.service';
import { PaymentService } from '../../payment/payment.service';
import * as TelegramBot from 'node-telegram-bot-api';

interface CourseInput {
  title_uz: string;
  title_ru: string;
  title_en: string;
  desc_uz: string;
  desc_ru: string;
  desc_en: string;
  price: number;
}

interface LessonInput {
  title_uz: string;
  title_ru: string;
  title_en: string;
  contentType: string;
  contentUrl: string;
  order: number;
}

interface QuizInput {
  question_uz: string;
  question_ru: string;
  question_en: string;
  options_uz: string[];
  options_ru: string[];
  options_en: string[];
  correctAnswer: number;
}

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
    private readonly paymentService: PaymentService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = BigInt(msg.from.id).toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    const isAdmin = await this.authService.isAdmin(telegramId);
    if (!isAdmin) {
      const message = this.i18nService.getTranslation('errors.access_denied', language);
      await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
      return;
    }

    if (msg.text === '/admin') {
      const message = this.i18nService.getTranslation('admin.panel', language);
      await this.sendMessageWithAdminMenu(chatId, message, language);
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
                               name: this.escapeMarkdown(user.fullName || 'N/A'),
                               phone: user.phoneNumber || 'N/A',
                               email: user.email || 'N/A',
                             })
                           ).join('\n\n')
                         : this.i18nService.getTranslation('errors.user_not_found', language));
        await this.telegramService.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        return;
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.user_fetch_error', language) || 'Foydalanuvchilar ma\'lumotlarini olishda xato yuz berdi';
        await this.sendMessageWithAdminMenu(chatId, message, language);
        return;
      }
    } else if (msg.text === this.i18nService.getTranslation('admin.user_payments', language)) {
      try {
        const payments = await this.paymentService.getAllPayments();
        const message = payments.length > 0
          ? this.i18nService.getTranslation('admin.user_payments', language) + '\n\n' +
            payments.map((payment, index) =>
              `${index + 1}. *${this.escapeMarkdown(payment.course.title[language])}*\n` +
              `👤 *${this.i18nService.getTranslation('payment.user', language)}*: ${this.escapeMarkdown(payment.user.fullName || 'N/A')}\n` +
              `💰 *${this.i18nService.getTranslation('payment.amount', language)}*: ${payment.amount} UZS\n` +
              `📅 *${this.i18nService.getTranslation('payment.date', language)}*: ${payment.createdAt.toLocaleDateString()}\n` +
              `🔖 *${this.i18nService.getTranslation('payment.status', language)}*: ${this.escapeMarkdown(payment.status)}`
            ).join('\n\n')
          : this.i18nService.getTranslation('admin.no_user_payments', language) || 'Hozircha foydalanuvchi to‘lovlari mavjud emas';
        await this.telegramService.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        return;
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.payment_fetch_error', language) || 'Foydalanuvchi to‘lovlarini olishda xato yuz berdi';
        await this.sendMessageWithAdminMenu(chatId, message, language);
        return;
      }
    } else if (msg.text === this.i18nService.getTranslation('admin.broadcast', language)) {
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('admin.broadcast', language) + '\n' +
        this.i18nService.getTranslation('admin.enter_broadcast_message', language),
        { reply_markup: { force_reply: true } },
      );
      bot.once('message', async (reply) => {
        if (reply.chat.id === chatId) {
          try {
            await this.notificationService.broadcast(this.escapeMarkdown(reply.text), { parse_mode: 'Markdown' });
            const message = this.i18nService.getTranslation('success.broadcast_sent', language);
            await this.sendMessageWithAdminMenu(chatId, message, language);
          } catch (error) {
            const message = this.i18nService.getTranslation('errors.invalid_input', language);
            await this.sendMessageWithAdminMenu(chatId, message, language);
          }
        }
      });
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.user_panel', language)) {
  const message = this.i18nService.getTranslation('welcome.message', language, { name: user ? user.fullName || 'Foydalanuvchi' : 'Foydalanuvchi' });
  this.telegramService.setForceUserPanel(String(chatId), true);
  await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId, true, user);
  return;
    } else if (msg.text === this.i18nService.getTranslation('menu.language', language)) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('language.select', language), {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🇺🇿 O‘zbek', callback_data: 'lang_uz' }],
            [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
            [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
          ],
        },
      });
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
            const coursesData = this.parseMultipleCourseInput(reply.text, language);
            const createdCourses = await this.courseService.createCourses(coursesData.map(courseData => ({
              title: {
                uz: courseData.title_uz,
                ru: courseData.title_ru,
                en: courseData.title_en,
              },
              description: {
                uz: courseData.desc_uz,
                ru: courseData.desc_ru,
                en: courseData.desc_en,
              },
              price: courseData.price,
              isPaid: courseData.price > 0,
            })));
            const message = this.i18nService.getTranslation('success.course_created', language, { title: createdCourses.map(c => this.escapeMarkdown(c.title[language])).join(', ') });
            await this.sendManageCoursesMenu(chatId, message, language);
          } catch (error) {
            const message = this.i18nService.getTranslation('errors.invalid_input', language);
            await this.sendManageCoursesMenu(chatId, message, language);
          }
        }
      });
      return;
    } else if (msg.text?.trim() === this.i18nService.getTranslation('admin.view_courses', language).trim()) {
      try {
        const courses = await this.courseService.findAll();
        const message =
          courses.length > 0
            ? this.i18nService.getTranslation('courses.list', language) + '\n\n' +
              courses.map((course, index) =>
                `${index + 1}. *${this.escapeMarkdown(course.title[language])}*\n` +
                `📝 ${this.escapeMarkdown(course.description[language])}\n` +
                `💰 ${course.isPaid ? `${course.price} UZS` : this.i18nService.getTranslation('courses.free', language)}`
              ).join('\n\n')
            : this.i18nService.getTranslation('courses.no_courses', language);
        await this.sendManageCoursesMenu(chatId, message, language);
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.course_fetch_error', language) || 'Kurslarni olishda xato yuz berdi';
        await this.sendManageCoursesMenu(chatId, message, language);
      }
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.delete_course', language)) {
      try {
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
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.course_fetch_error', language) || 'Kurslarni olishda xato yuz berdi';
        await this.sendManageCoursesMenu(chatId, message, language);
      }
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.create_lesson', language)) {
      try {
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
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.course_fetch_error', language) || 'Kurslarni olishda xato yuz berdi';
        await this.sendManageLessonsMenu(chatId, message, language);
      }
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.view_lessons', language)) {
      try {
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
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.course_fetch_error', language) || 'Kurslarni olishda xato yuz berdi';
        await this.sendManageLessonsMenu(chatId, message, language);
      }
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.delete_lesson', language)) {
      try {
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
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.course_fetch_error', language) || 'Kurslarni olishda xato yuz berdi';
        await this.sendManageLessonsMenu(chatId, message, language);
      }
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.create_quiz', language)) {
      try {
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
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.course_fetch_error', language) || 'Kurslarni olishda xato yuz berdi';
        await this.sendManageQuizzesMenu(chatId, message, language);
      }
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.view_quizzes', language)) {
      try {
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
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.quiz_fetch_error', language) || 'Testlarni olishda xato yuz berdi';
        await this.sendManageQuizzesMenu(chatId, message, language);
      }
      return;
    } else if (msg.text === this.i18nService.getTranslation('admin.delete_quiz', language)) {
      try {
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
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.quiz_fetch_error', language) || 'Testlarni olishda xato yuz berdi';
        await this.sendManageQuizzesMenu(chatId, message, language);
      }
      return;
    }
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = BigInt(query.from.id).toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const data = query.data;

    if (data === 'manage_courses_back' || data === 'delete_course_back') {
      const message = this.i18nService.getTranslation('admin.manage_courses', language);
      await this.sendManageCoursesMenu(chatId, message, language);
    } else if (data === 'manage_lessons_back' || data === 'delete_lesson_back') {
      const message = this.i18nService.getTranslation('admin.manage_lessons', language);
      await this.sendManageLessonsMenu(chatId, message, language);
    } else if (data === 'manage_quizzes_back' || data === 'delete_quiz_back') {
      const message = this.i18nService.getTranslation('admin.manage_quizzes', language);
      await this.sendManageQuizzesMenu(chatId, message, language);
    } else if (data.startsWith('delete_course_')) {
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
            const lessonsData = this.parseMultipleLessonInput(reply.text, language);
            const createdLessons = await this.lessonService.createLessons(lessonsData.map(lessonData => ({
              courseId,
              title: {
                uz: lessonData.title_uz,
                ru: lessonData.title_ru,
                en: lessonData.title_en,
              },
              contentType: lessonData.contentType,
              contentUrl: lessonData.contentUrl,
              order: lessonData.order,
            })));
            const message = this.i18nService.getTranslation('success.lesson_created', language, { title: createdLessons.map(l => this.escapeMarkdown(l.title[language])).join(', ') });
            await this.sendManageLessonsMenu(chatId, message, language);
          } catch (error) {
            const message = this.i18nService.getTranslation('errors.invalid_input', language);
            await this.sendManageLessonsMenu(chatId, message, language);
          }
        }
      });
    } else if (data.startsWith('view_lessons_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        const message = this.i18nService.getTranslation('errors.course_not_found', language);
        await this.sendManageLessonsMenu(chatId, message, language);
        return;
      }
      try {
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
        await this.telegramService.sendMessage(chatId, message, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.lesson_fetch_error', language) || 'Darslarni olishda xato yuz berdi';
        await this.sendManageLessonsMenu(chatId, message, language);
      }
    } else if (data.startsWith('delete_lesson_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        const message = this.i18nService.getTranslation('errors.course_not_found', language);
        await this.sendManageLessonsMenu(chatId, message, language);
        return;
      }
      try {
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
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.lesson_fetch_error', language) || 'Darslarni olishda xato yuz berdi';
        await this.sendManageLessonsMenu(chatId, message, language);
      }
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
            const quizzesData = this.parseMultipleQuizInput(reply.text, language);
            const createdQuizzes = await this.quizService.createQuizzes(quizzesData.map(quizData => ({
              courseId,
              questions: [{
                question: {
                  uz: quizData.question_uz,
                  ru: quizData.question_ru,
                  en: quizData.question_en,
                },
                options: [
                  { uz: quizData.options_uz[0], ru: quizData.options_ru[0], en: quizData.options_en[0] },
                  { uz: quizData.options_uz[1], ru: quizData.options_ru[1], en: quizData.options_en[1] },
                  { uz: quizData.options_uz[2], ru: quizData.options_ru[2], en: quizData.options_en[2] },
                  { uz: quizData.options_uz[3], ru: quizData.options_ru[3], en: quizData.options_en[3] },
                ],
                correct: quizData.correctAnswer,
              }],
            })));
            const message = this.i18nService.getTranslation('success.quiz_created', language, { question: createdQuizzes.map(q => this.escapeMarkdown(q.questions[0].question[language])).join(', ') });
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
      try {
        const quizzes = await this.quizService.findByCourseId(courseId);
        const message = quizzes.length > 0
          ? this.i18nService.getTranslation('quizzes.list', language) + '\n\n' +
            quizzes.map((quiz, index) => {
              const question = quiz.questions[0];
              const questionText = this.escapeMarkdown(question?.question[language] || 'Quiz');
              const options = question?.options.map(opt => opt[language]) || [];
              const formattedOptions = options.length > 0 ? options.map(opt => this.escapeMarkdown(opt)).join(', ') : 'N/A';
              const correctAnswer = options.length > question.correct ? this.escapeMarkdown(options[question.correct]) : 'N/A';
              return `${index + 1}. *${questionText}*\n` +
                     `📝 *${this.i18nService.getTranslation('quizzes.options', language)}*: ${formattedOptions}\n` +
                     `✅ *${this.i18nService.getTranslation('quizzes.correct', language)}*: ${correctAnswer}`;
            }).join('\n\n')
          : this.i18nService.getTranslation('quizzes.no_quizzes_for_course', language);
        await this.telegramService.sendMessage(chatId, message, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.quiz_fetch_error', language) || 'Testlarni olishda xato yuz berdi';
        await this.sendManageQuizzesMenu(chatId, message, language);
      }
    } else if (data.startsWith('delete_quiz_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      const course = await this.courseService.findById(courseId);
      if (!course) {
        const message = this.i18nService.getTranslation('errors.course_not_found', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      try {
        const quizzes = await this.quizService.findByCourseId(courseId);
        if (!quizzes.length) {
          const message = this.i18nService.getTranslation('quizzes.no_quizzes_for_course', language);
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: quizzes.map((quiz) => [
              { text: this.escapeMarkdown(quiz.questions[0]?.question[language] || 'Quiz'), callback_data: `delete_quiz_${quiz.id}` },
            ]),
          },
        };
        await bot.sendMessage(
          chatId,
          this.i18nService.getTranslation('admin.delete_quiz', language) + '\n' +
          this.i18nService.getTranslation('admin.select_quiz_to_delete', language),
          keyboard,
        );
      } catch (error) {
        const message = this.i18nService.getTranslation('errors.quiz_fetch_error', language) || 'Testlarni olishda xato yuz berdi';
        await this.sendManageQuizzesMenu(chatId, message, language);
      }
    } else if (data.startsWith('delete_quiz_')) {
      const quizId = parseInt(data.split('_')[2], 10);
      const quiz = await this.quizService.findById(quizId);
      if (!quiz) {
        const message = this.i18nService.getTranslation('errors.quiz_not_found', language);
        await this.sendManageQuizzesMenu(chatId, message, language);
        return;
      }
      await this.quizService.deleteQuiz(quizId);
      const message = this.i18nService.getTranslation('success.quiz_deleted', language, { question: this.escapeMarkdown(quiz.questions[0]?.question[language] || 'Quiz') });
      await this.sendManageQuizzesMenu(chatId, message, language);
    }
    await bot.answerCallbackQuery(query.id);
  }

  async sendMessageWithAdminMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, message, {
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

  private parseMultipleCourseInput(input: string, language: string): CourseInput[] {
    const courses = input.split('\n---\n').map(item => item.trim());
    const result: CourseInput[] = [];
    for (const course of courses) {
      const lines = course.split('\n').map(line => line.trim());
      const expectedFormat = [
        'Kurs nomi uz', 'Kurs nomi ru', 'Kurs nomi en',
        'Ta’rif uz', 'Ta’rif ru', 'Ta’rif en', 'Narx',
      ];
      if (lines.length < expectedFormat.length) {
        throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
      }
      const data: CourseInput = {
        title_uz: '',
        title_ru: '',
        title_en: '',
        desc_uz: '',
        desc_ru: '',
        desc_en: '',
        price: 0,
      };
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
      result.push(data);
    }
    return result;
  }

 private parseMultipleLessonInput(input: string, language: string): LessonInput[] {
  const lessons = input.split('\n---\n').map(item => item.trim());
  const result: LessonInput[] = [];

  for (const lesson of lessons) {
    const lines = lesson.split('\n').map(line => line.trim());

    const data: LessonInput = {
      title_uz: '',
      title_ru: '',
      title_en: '',
      contentType: '',
      contentUrl: '',
      order: 0,
    };

    lines.forEach(line => {
      if (line.toLowerCase().startsWith('dars nomi uz:')) data.title_uz = line.split(':')[1]?.trim() || '';
      if (line.toLowerCase().startsWith('dars nomi ru:')) data.title_ru = line.split(':')[1]?.trim() || '';
      if (line.toLowerCase().startsWith('dars nomi en:')) data.title_en = line.split(':')[1]?.trim() || '';
      if (line.toLowerCase().startsWith('kontent turi:')) data.contentType = line.split(':')[1]?.trim() || '';
      if (
        line.toLowerCase().startsWith('kontent url:') ||
        line.toLowerCase().startsWith('kontent havolasi:')
      ) {
        data.contentUrl = line.split(':')[1]?.trim() || '';
      }
      if (line.toLowerCase().startsWith('tartib:')) {
        const orderStr = line.split(':')[1]?.trim();
        data.order = orderStr ? parseInt(orderStr, 10) : 0;
      }
    });

    if (!data.title_uz || !data.title_ru || !data.title_en || !data.contentType || !data.contentUrl || isNaN(data.order)) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }

    result.push(data);
  }

  return result;
}

  private parseMultipleQuizInput(input: string, language: string): QuizInput[] {
    const quizzes = input.split('\n---\n').map(item => item.trim());
    const result: QuizInput[] = [];
    for (const quiz of quizzes) {
      const lines = quiz.split('\n').map(line => line.trim());
      const expectedFormat = [
        'Savol uz', 'Savol ru', 'Savol en',
        'Variantlar uz', 'Variantlar ru', 'Variantlar en',
        'To‘g‘ri javob',
      ];
      if (lines.length < expectedFormat.length) {
        throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
      }
      const data: QuizInput = {
        question_uz: '',
        question_ru: '',
        question_en: '',
        options_uz: [],
        options_ru: [],
        options_en: [],
        correctAnswer: 0,
      };
      lines.forEach(line => {
        if (line.startsWith('Savol uz:')) data.question_uz = line.replace('Savol uz:', '').trim();
        if (line.startsWith('Savol ru:')) data.question_ru = line.replace('Savol ru:', '').trim();
        if (line.startsWith('Savol en:')) data.question_en = line.replace('Savol en:', '').trim();
        if (line.startsWith('Variantlar uz:')) data.options_uz = line.replace('Variantlar uz:', '').trim().split(',').map(opt => opt.trim());
        if (line.startsWith('Variantlar ru:')) data.options_ru = line.replace('Variantlar ru:', '').trim().split(',').map(opt => opt.trim());
        if (line.startsWith('Variantlar en:')) data.options_en = line.replace('Variantlar en:', '').trim().split(',').map(opt => opt.trim());
        if (line.startsWith('To‘g‘ri javob:')) data.correctAnswer = parseInt(line.replace('To‘g‘ri javob:', '').trim(), 10) - 1;
      });
      if (
        !data.question_uz || !data.question_ru || !data.question_en ||
        data.options_uz.length !== 4 || data.options_ru.length !== 4 || data.options_en.length !== 4 ||
        isNaN(data.correctAnswer) || data.correctAnswer < 0 || data.correctAnswer > 3
      ) {
        throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
      }
      result.push(data);
    }
    return result;
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
}