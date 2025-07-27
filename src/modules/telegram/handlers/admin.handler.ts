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

    try {
      if (msg.text === '/admin') {
        const message = this.i18nService.getTranslation('admin.panel', language);
        await this.sendMessageWithAdminMenu(chatId, message, language);
      } else if (msg.text === this.i18nService.getTranslation('admin.user_stats', language)) {
  const users = await this.userService.findAll();
  const totalUsers = users.length;

  const header = this.escapeMarkdown(this.i18nService.getTranslation('stats.header', language));
  const total = this.escapeMarkdown(
    this.i18nService.getTranslation('stats.total_users', language, {
      totalUsers: totalUsers.toString(),
    }),
  );
  const listTitle = this.escapeMarkdown(this.i18nService.getTranslation('stats.users_list', language));

  const userList =
    users.length > 0
      ? users
          .map((user, index) => {
            const id = this.escapeMarkdown(user.telegramId);
            const name = this.escapeMarkdown(user.fullName || 'N/A');
            const phone = this.escapeMarkdown(user.phoneNumber || 'N/A');
            const email = this.escapeMarkdown(user.email || 'N/A');

            const info = this.i18nService.getTranslation('stats.user_info', language, {
              id,
              name,
              phone,
              email,
            });

            return `${index + 1}\\. ${this.escapeMarkdown(info)}`;
          })
          .join('\n\n')
      : this.escapeMarkdown(this.i18nService.getTranslation('errors.user_not_found', language));

  const message = `${header}\n\n${total}\n\n${listTitle}\n\n${userList}`;

  await this.telegramService.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });

      } else if (msg.text === this.i18nService.getTranslation('admin.user_payments', language)) {
        const payments = await this.paymentService.getAllPayments();
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.user_payments', language)) +
          '\n\n' +
          (payments.length > 0
            ? payments
                .map(
                  (payment, index) =>
                    `${index + 1}\\. *${this.escapeMarkdown(payment.course?.title[language] || 'N/A')}*\n` +
                    `👤 *${this.escapeMarkdown(this.i18nService.getTranslation('payment.user', language))}*: ${this.escapeMarkdown(
                      payment.user?.fullName || 'N/A',
                    )}\n` +
                    `💰 *${this.escapeMarkdown(this.i18nService.getTranslation('payment.amount', language))}*: ${payment.amount} UZS\n` +
                    `📅 *${this.escapeMarkdown(this.i18nService.getTranslation('payment.date', language))}*: ${this.escapeMarkdown(
                      payment.createdAt?.toLocaleDateString() || 'N/A',
                    )}\n` +
                    `🔖 *${this.escapeMarkdown(this.i18nService.getTranslation('payment.status', language))}*: ${this.escapeMarkdown(payment.status || 'N/A')}`,
                )
                .join('\n\n')
            : this.escapeMarkdown(this.i18nService.getTranslation('admin.no_user_payments', language)));
        await this.telegramService.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      } else if (msg.text === this.i18nService.getTranslation('admin.broadcast', language)) {
        await bot.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('admin.enter_broadcast_message', language)),
          { reply_markup: { force_reply: true } },
        );
        bot.once('message', async (reply) => {
          if (reply.chat.id === chatId) {
            await this.notificationService.broadcast(this.escapeMarkdown(reply.text), { parse_mode: 'MarkdownV2' });
            const message = this.escapeMarkdown(this.i18nService.getTranslation('success.broadcast_sent', language));
            await this.sendMessageWithAdminMenu(chatId, message, language);
          }
        });
      } else if (msg.text === this.i18nService.getTranslation('admin.user_panel', language)) {
        const message = this.escapeMarkdown(
          this.i18nService.getTranslation('welcome.message', language, {
            name: user ? user.fullName || 'Foydalanuvchi' : 'Foydalanuvchi',
          }),
        );
        this.telegramService.setForceUserPanel(String(chatId), true);
        await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId, true, user);
      } else if (msg.text === this.i18nService.getTranslation('menu.language', language)) {
        await bot.sendMessage(chatId, this.escapeMarkdown(this.i18nService.getTranslation('language.select', language)), {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🇺🇿 O‘zbek', callback_data: 'lang_uz' }],
              [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
              [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
            ],
          },
        });
      } else if (msg.text === this.i18nService.getTranslation('admin.manage_courses', language)) {
        const message = this.escapeMarkdown(this.i18nService.getTranslation('admin.manage_courses', language));
        await this.sendManageCoursesMenu(chatId, message, language);
      } else if (msg.text === this.i18nService.getTranslation('admin.manage_lessons', language)) {
        const message = this.escapeMarkdown(this.i18nService.getTranslation('admin.manage_lessons', language));
        await this.sendManageLessonsMenu(chatId, message, language);
      } else if (msg.text === this.i18nService.getTranslation('admin.manage_quizzes', language)) {
        const message = this.escapeMarkdown(this.i18nService.getTranslation('admin.manage_quizzes', language));
        await this.sendManageQuizzesMenu(chatId, message, language);
      } else if (msg.text === this.i18nService.getTranslation('quizzes.mixed_quizzes', language)) {
        const message = this.escapeMarkdown(this.i18nService.getTranslation('quizzes.mixed_quizzes', language));
        await this.sendManageMixedQuizzesMenu(chatId, message, language);
      } else if (msg.text === this.i18nService.getTranslation('admin.create_course', language)) {
        await bot.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_course_prompt', language)),
          { reply_markup: { force_reply: true } },
        );
        bot.once('message', async (reply) => {
          if (reply.chat.id === chatId) {
            try {
              const coursesData = this.parseMultipleCourseInput(reply.text, language);
              const createdCourses = await this.courseService.createCourses(
                coursesData.map((courseData) => ({
                  title: { uz: courseData.title_uz, ru: courseData.title_ru, en: courseData.title_en },
                  description: { uz: courseData.desc_uz, ru: courseData.desc_ru, en: courseData.desc_en },
                  price: courseData.price,
                  isPaid: courseData.price > 0,
                })),
              );
              const message = this.escapeMarkdown(
                this.i18nService.getTranslation('success.course_created', language, {
                  title: createdCourses.map((c) => c.title[language]).join(', '),
                }),
              );
              await this.sendManageCoursesMenu(chatId, message, language);
            } catch (error) {
              const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
              await this.sendManageCoursesMenu(chatId, message, language);
            }
          }
        });
      } else if (msg.text === this.i18nService.getTranslation('admin.view_courses', language)) {
        const courses = await this.courseService.findAll();
        if (!courses || courses.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language));
          await this.sendManageCoursesMenu(chatId, message, language);
          return;
        }
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.view_courses', language)) +
          '\n\n' +
          courses
            .map(
              (course, index) =>
                `${index + 1}\\. *${this.escapeMarkdown(course.title[language] || 'N/A')}*\n` +
                `📝 *${this.escapeMarkdown(this.i18nService.getTranslation('courses.description', language))}*: ${this.escapeMarkdown(
                  course.description[language] || 'N/A',
                )}\n` +
                `💰 *${this.escapeMarkdown(this.i18nService.getTranslation('courses.price', language))}*: ${
                  course.isPaid ? `${course.price} UZS` : this.escapeMarkdown(this.i18nService.getTranslation('courses.free', language))
                }`,
            )
            .join('\n\n');
        await this.telegramService.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      } else if (msg.text === this.i18nService.getTranslation('admin.delete_course', language)) {
        const courses = await this.courseService.findAll();
        if (!courses || courses.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language));
          await this.sendManageCoursesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: courses
              .map((course) => [{ text: this.escapeMarkdown(course.title[language] || 'N/A'), callback_data: `delete_course_${course.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_courses_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.delete_course', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_course_to_delete', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (msg.text === this.i18nService.getTranslation('admin.create_lesson', language)) {
        const courses = await this.courseService.findAll();
        if (!courses || courses.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: courses
              .map((course) => [{ text: this.escapeMarkdown(course.title[language] || 'N/A'), callback_data: `create_lesson_course_${course.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_lessons_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_lesson', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_course_for_lesson', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (msg.text === this.i18nService.getTranslation('admin.view_lessons', language)) {
        const courses = await this.courseService.findAll();
        if (!courses || courses.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: courses
              .map((course) => [{ text: this.escapeMarkdown(course.title[language] || 'N/A'), callback_data: `view_lessons_course_${course.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_lessons_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.view_lessons', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_course_for_lessons', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (msg.text === this.i18nService.getTranslation('admin.delete_lesson', language)) {
        const courses = await this.courseService.findAll();
        if (!courses || courses.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: courses
              .map((course) => [{ text: this.escapeMarkdown(course.title[language] || 'N/A'), callback_data: `delete_lesson_course_${course.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_lessons_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.delete_lesson', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_course_to_delete_lesson', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (msg.text === this.i18nService.getTranslation('admin.create_quiz', language)) {
        const courses = await this.courseService.findAll();
        if (!courses || courses.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: courses
              .map((course) => [{ text: this.escapeMarkdown(course.title[language] || 'N/A'), callback_data: `create_quiz_course_${course.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_quizzes_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_quiz', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_course_for_quiz', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (msg.text === this.i18nService.getTranslation('admin.view_quizzes', language)) {
        const courses = await this.courseService.findAll();
        if (!courses || courses.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: courses
              .map((course) => [{ text: this.escapeMarkdown(course.title[language] || 'N/A'), callback_data: `view_quizzes_course_${course.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_quizzes_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.view_quizzes', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_course_for_quizzes', language, {}));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (msg.text === this.i18nService.getTranslation('admin.delete_quiz', language)) {
        const courses = await this.courseService.findAll();
        if (!courses || courses.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('courses.no_courses', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: courses
              .map((course) => [{ text: this.escapeMarkdown(course.title[language] || 'N/A'), callback_data: `delete_quiz_course_${course.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_quizzes_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.delete_quiz', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_course_to_delete_quiz', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (msg.text === this.i18nService.getTranslation('admin.create_mixed_quiz', language)) {
        await bot.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_mixed_quiz_prompt', language)),
          { reply_markup: { force_reply: true } },
        );
        bot.once('message', async (reply) => {
          if (reply.chat.id === chatId) {
            try {
              const quizzesData = this.parseMultipleQuizInput(reply.text, language);
              const createdQuizzes = await this.quizService.createQuizzes(
                quizzesData.map((quizData) => ({
                  courseId: undefined,
                  lessonId: undefined,
                  questions: [
                    {
                      question: { uz: quizData.question_uz, ru: quizData.question_ru, en: quizData.question_en },
                      options: [
                        { uz: quizData.options_uz[0], ru: quizData.options_ru[0], en: quizData.options_en[0] },
                        { uz: quizData.options_uz[1], ru: quizData.options_ru[1], en: quizData.options_en[1] },
                        { uz: quizData.options_uz[2], ru: quizData.options_ru[2], en: quizData.options_en[2] },
                        { uz: quizData.options_uz[3], ru: quizData.options_ru[3], en: quizData.options_en[3] },
                      ],
                      correct: quizData.correctAnswer,
                    },
                  ],
                })),
              );
              const message = this.escapeMarkdown(
                this.i18nService.getTranslation('success.quiz_created', language, {
                  question: createdQuizzes.map((q) => q.questions[0]?.question[language] || 'N/A').join(', '),
                }),
              );
              await this.sendManageMixedQuizzesMenu(chatId, message, language);
            } catch (error) {
              const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
              await this.sendManageMixedQuizzesMenu(chatId, message, language);
            }
          }
        });
      } else if (msg.text === this.i18nService.getTranslation('admin.view_mixed_quizzes', language)) {
        const quizzes = await this.quizService.findMixedQuizzes();
        if (!quizzes || quizzes.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('quizzes.no_mixed_quizzes', language));
          await this.sendManageMixedQuizzesMenu(chatId, message, language);
          return;
        }
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('quizzes.list', language)) +
          '\n\n' +
          quizzes
            .map((quiz, index) => {
              const question = quiz.questions[0];
              const questionText = this.escapeMarkdown(question?.question[language] || 'N/A');
              const options = question?.options?.map((opt) => opt[language]) || [];
              const formattedOptions = options.length > 0 ? options.map((opt) => this.escapeMarkdown(opt)).join(', ') : 'N/A';
              const correctAnswer = options.length > question.correct ? this.escapeMarkdown(options[question.correct]) : 'N/A';
              return `${index + 1}\\. *${questionText}*\n` +
                `📝 *${this.escapeMarkdown(this.i18nService.getTranslation('quizzes.options', language))}*: ${formattedOptions}\n` +
                `✅ *${this.escapeMarkdown(this.i18nService.getTranslation('quizzes.correct', language))}*: ${correctAnswer}`;
            })
            .join('\n\n');
        await this.telegramService.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      } else if (msg.text === this.i18nService.getTranslation('admin.delete_mixed_quiz', language)) {
        const quizzes = await this.quizService.findMixedQuizzes();
        if (!quizzes || quizzes.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('quizzes.no_mixed_quizzes', language));
          await this.sendManageMixedQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: quizzes
              .map((quiz, index) => [
                { text: this.escapeMarkdown(quiz.questions[0]?.question[language] || `Quiz ${index + 1}`), callback_data: `delete_mixed_quiz_${quiz.id}` },
              ])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_mixed_quizzes_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.delete_mixed_quiz', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_quiz_to_delete', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      }
    } catch (error) {
      const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', language));
      await this.sendMessageWithAdminMenu(chatId, message, language);
    }
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = BigInt(query.from.id).toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const data = query.data;

    try {
      if (data === 'manage_courses_back') {
        const message = this.escapeMarkdown(this.i18nService.getTranslation('admin.manage_courses', language));
        await this.sendManageCoursesMenu(chatId, message, language);
      } else if (data === 'manage_lessons_back') {
        const message = this.escapeMarkdown(this.i18nService.getTranslation('admin.manage_lessons', language));
        await this.sendManageLessonsMenu(chatId, message, language);
      } else if (data === 'manage_quizzes_back') {
        const message = this.escapeMarkdown(this.i18nService.getTranslation('admin.manage_quizzes', language));
        await this.sendManageQuizzesMenu(chatId, message, language);
      } else if (data === 'manage_mixed_quizzes_back') {
        const message = this.escapeMarkdown(this.i18nService.getTranslation('quizzes.mixed_quizzes', language));
        await this.sendManageMixedQuizzesMenu(chatId, message, language);
      } else if (data.startsWith('delete_course_')) {
        const courseId = parseInt(data.split('_')[2], 10);
        if (isNaN(courseId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageCoursesMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageCoursesMenu(chatId, message, language);
          return;
        }
        await this.courseService.deleteCourse(courseId);
        const message = this.escapeMarkdown(
          this.i18nService.getTranslation('success.course_deleted', language, { title: course.title[language] || 'N/A' }),
        );
        await this.sendManageCoursesMenu(chatId, message, language);
      } else if (data.startsWith('create_lesson_course_')) {
        const courseId = parseInt(data.split('_')[3], 10);
        if (isNaN(courseId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        await bot.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_lesson_prompt', language)),
          { reply_markup: { force_reply: true } },
        );
        bot.once('message', async (reply) => {
          if (reply.chat.id === chatId) {
            try {
              const lessonsData = this.parseMultipleLessonInput(reply.text, language);
              const createdLessons = await this.lessonService.createLessons(
                lessonsData.map((lessonData) => ({
                  courseId,
                  title: { uz: lessonData.title_uz, ru: lessonData.title_ru, en: lessonData.title_en },
                  contentType: lessonData.contentType,
                  contentUrl: lessonData.contentUrl,
                  order: lessonData.order,
                })),
              );
              const message = this.escapeMarkdown(
                this.i18nService.getTranslation('success.lesson_created', language, {
                  title: createdLessons.map((l) => l.title[language] || 'N/A').join(', '),
                }),
              );
              await this.sendManageLessonsMenu(chatId, message, language);
            } catch (error) {
              const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
              await this.sendManageLessonsMenu(chatId, message, language);
            }
          }
        });
      } else if (data.startsWith('view_lessons_course_')) {
        const courseId = parseInt(data.split('_')[3], 10);
        if (isNaN(courseId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const lessons = await this.lessonService.findByCourseId(courseId);
        if (!lessons || lessons.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('lessons.no_lessons', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.view_lessons', language)) +
          '\n\n' +
          lessons
            .map(
              (lesson, index) =>
                `${index + 1}\\. *${this.escapeMarkdown(lesson.title[language] || 'N/A')}*\n` +
                `📝 *${this.escapeMarkdown(this.i18nService.getTranslation('lessons.type', language))}*: ${this.escapeMarkdown(lesson.contentType || 'N/A')}\n` +
                `🔗 *${this.escapeMarkdown(this.i18nService.getTranslation('lessons.url', language))}*: ${this.escapeMarkdown(lesson.contentUrl || 'N/A')}\n` +
                `🔢 *${this.escapeMarkdown(this.i18nService.getTranslation('lessons.order', language))}*: ${lesson.order || 0}`,
            )
            .join('\n\n');
        await this.telegramService.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      } else if (data.startsWith('delete_lesson_course_')) {
        const courseId = parseInt(data.split('_')[3], 10);
        if (isNaN(courseId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const lessons = await this.lessonService.findByCourseId(courseId);
        if (!lessons || lessons.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('lessons.no_lessons', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: lessons
              .map((lesson) => [{ text: this.escapeMarkdown(lesson.title[language] || 'N/A'), callback_data: `delete_lesson_${lesson.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_lessons_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.delete_lesson', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_lesson_to_delete', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (data.startsWith('delete_lesson_')) {
        const lessonId = parseInt(data.split('_')[2], 10);
        if (isNaN(lessonId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        const lesson = await this.lessonService.findById(lessonId);
        if (!lesson) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.lesson_not_found', language));
          await this.sendManageLessonsMenu(chatId, message, language);
          return;
        }
        await this.lessonService.deleteLesson(lessonId);
        const message = this.escapeMarkdown(
          this.i18nService.getTranslation('success.lesson_deleted', language, { title: lesson.title[language] || 'N/A' }),
        );
        await this.sendManageLessonsMenu(chatId, message, language);
      } else if (data.startsWith('create_quiz_course_')) {
        const courseId = parseInt(data.split('_')[3], 10);
        if (isNaN(courseId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const lessons = await this.lessonService.findByCourseId(courseId);
        if (!lessons || lessons.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('lessons.no_lessons', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: lessons
              .map((lesson) => [{ text: this.escapeMarkdown(lesson.title[language] || 'N/A'), callback_data: `create_quiz_lesson_${courseId}_${lesson.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_quizzes_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_quiz', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_lesson_for_quiz', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (data.startsWith('create_quiz_lesson_')) {
        const parts = data.split('_');
        const courseId = parseInt(parts[3], 10);
        const lessonId = parseInt(parts[4], 10);
        if (isNaN(courseId) || isNaN(lessonId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const lesson = await this.lessonService.findById(lessonId);
        if (!lesson) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.lesson_not_found', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        await bot.sendMessage(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('admin.create_quiz_prompt', language)),
          { reply_markup: { force_reply: true } },
        );
        bot.once('message', async (reply) => {
          if (reply.chat.id === chatId) {
            try {
              const quizzesData = this.parseMultipleQuizInput(reply.text, language);
              const createdQuizzes = await this.quizService.createQuizzes(
                quizzesData.map((quizData) => ({
                  courseId,
                  lessonId,
                  questions: [
                    {
                      question: { uz: quizData.question_uz, ru: quizData.question_ru, en: quizData.question_en },
                      options: [
                        { uz: quizData.options_uz[0], ru: quizData.options_ru[0], en: quizData.options_en[0] },
                        { uz: quizData.options_uz[1], ru: quizData.options_ru[1], en: quizData.options_en[1] },
                        { uz: quizData.options_uz[2], ru: quizData.options_ru[2], en: quizData.options_en[2] },
                        { uz: quizData.options_uz[3], ru: quizData.options_ru[3], en: quizData.options_en[3] },
                      ],
                      correct: quizData.correctAnswer,
                    },
                  ],
                })),
              );
              const message = this.escapeMarkdown(
                this.i18nService.getTranslation('success.quiz_created', language, {
                  question: createdQuizzes.map((q) => q.questions[0]?.question[language] || 'N/A').join(', '),
                }),
              );
              await this.sendManageQuizzesMenu(chatId, message, language);
            } catch (error) {
              const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
              await this.sendManageQuizzesMenu(chatId, message, language);
            }
          }
        });
      } else if (data.startsWith('view_quizzes_course_')) {
        const courseId = parseInt(data.split('_')[3], 10);
        if (isNaN(courseId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const lessons = await this.lessonService.findByCourseId(courseId);
        if (!lessons || lessons.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('lessons.no_lessons', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: lessons
              .map((lesson) => [{ text: this.escapeMarkdown(lesson.title[language] || 'N/A'), callback_data: `view_quizzes_lesson_${courseId}_${lesson.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language, {}) || 'Orqaga'), callback_data: 'manage_quizzes_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.view_quizzes', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_lesson_for_quizzes', language, {}) || 'Darsni tanlang');
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      }else if (data.startsWith('view_quizzes_lesson_')) {
  console.log('🔥 view_quizzes_lesson_ callback triggered:', data);

  const regex = /^view_quizzes_lesson_(\d+)_(\d+)$/;
  const match = data.match(regex);

  if (!match) {
    const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
    await this.sendManageQuizzesMenu(chatId, message, language);
    return;
  }

  const courseId = parseInt(match[1], 10);
  const lessonId = parseInt(match[2], 10);

  const course = await this.courseService.findById(courseId);
  if (!course) {
    const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
    await this.sendManageQuizzesMenu(chatId, message, language);
    return;
  }

  const lesson = await this.lessonService.findById(lessonId);
  if (!lesson) {
    const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.lesson_not_found', language));
    await this.sendManageQuizzesMenu(chatId, message, language);
    return;
  }

  const quizzes = await this.quizService.findAllByLessonId(lessonId);
  console.log('🧪 Topilgan testlar:', JSON.stringify(quizzes, null, 2));

  if (!quizzes || quizzes.length === 0) {
    const message = this.escapeMarkdown(this.i18nService.getTranslation('quizzes.no_quizzes_for_lesson', language));
    await this.sendManageQuizzesMenu(chatId, message, language);
    return;
  }

  let message =
    this.escapeMarkdown(this.i18nService.getTranslation('quizzes.list', language)) + '\n\n';

  quizzes.forEach((quiz, quizIndex) => {
    if (!quiz.questions || quiz.questions.length === 0) return;

    quiz.questions.forEach((question, questionIndex) => {
      const questionText = this.escapeMarkdown(question?.question?.[language] || `Savol ${questionIndex + 1}`);
      const optionsText = question?.options
        ?.map((opt) => this.escapeMarkdown(opt?.[language] || 'N/A'))
        .join(', ') || 'N/A';
      const correctAnswer =
        question?.options &&
        question.correct >= 0 &&
        question.correct < question.options.length
          ? this.escapeMarkdown(question.options[question.correct]?.[language] || 'N/A')
          : 'N/A';

      message += `${quizIndex + 1}\\.${questionIndex + 1}\\. *${questionText}*\n`;
      message += `📝 *${this.escapeMarkdown(this.i18nService.getTranslation('quizzes.options', language))}*: ${optionsText}\n`;
      message += `✅ *${this.escapeMarkdown(this.i18nService.getTranslation('quizzes.correct', language))}*: ${correctAnswer}\n\n`;
    });
  });

  await this.telegramService.sendMessage(chatId, message.trim(), {
    parse_mode: 'MarkdownV2',
  });
      } else if (data.startsWith('delete_quiz_course_')) {
        const courseId = parseInt(data.split('_')[3], 10);
        if (isNaN(courseId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const lessons = await this.lessonService.findByCourseId(courseId);
        if (!lessons || lessons.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('lessons.no_lessons', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: lessons
              .map((lesson) => [{ text: this.escapeMarkdown(lesson.title[language] || 'N/A'), callback_data: `delete_quiz_lesson_${courseId}_${lesson.id}` }])
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: 'manage_quizzes_back' }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.delete_quiz', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_lesson_to_delete_quiz', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (data.startsWith('delete_quiz_lesson_')) {
        const parts = data.split('_');
        const courseId = parseInt(parts[3], 10);
        const lessonId = parseInt(parts[4], 10);
        if (isNaN(courseId) || isNaN(lessonId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const course = await this.courseService.findById(courseId);
        if (!course) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.course_not_found', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const lesson = await this.lessonService.findById(lessonId);
        if (!lesson) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.lesson_not_found', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const quizzes = await this.quizService.findAllByLessonId(lessonId);
        if (!quizzes || quizzes.length === 0) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('quizzes.no_quizzes_for_lesson', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const keyboard = {
          reply_markup: {
            inline_keyboard: quizzes
              .flatMap((quiz, quizIndex) =>
                quiz.questions.map((question, questionIndex) => [
                  {
                    text: this.escapeMarkdown(question?.question[language] || `Quiz ${quizIndex + 1}.${questionIndex + 1}`),
                    callback_data: `delete_quiz_${quiz.id}_${questionIndex}`,
                  },
                ]),
              )
              .concat([[{ text: this.escapeMarkdown(this.i18nService.getTranslation('menu.back', language)), callback_data: `delete_quiz_course_${courseId}` }]]),
          },
        };
        const message =
          this.escapeMarkdown(this.i18nService.getTranslation('admin.delete_quiz', language)) +
          '\n' +
          this.escapeMarkdown(this.i18nService.getTranslation('admin.select_quiz_to_delete', language));
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2', ...keyboard });
      } else if (data.startsWith('delete_quiz_')) {
        const parts = data.split('_');
        const quizId = parseInt(parts[2], 10);
        if (isNaN(quizId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        const quiz = await this.quizService.findById(quizId);
        if (!quiz) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language));
          await this.sendManageQuizzesMenu(chatId, message, language);
          return;
        }
        await this.quizService.deleteQuiz(quizId);
        const message = this.escapeMarkdown(
          this.i18nService.getTranslation('success.quiz_deleted', language, {
            question: quiz.questions[0]?.question[language] || 'N/A',
          }),
        );
        await this.sendManageQuizzesMenu(chatId, message, language);
      } else if (data.startsWith('delete_mixed_quiz_')) {
        const quizId = parseInt(data.split('_')[3], 10);
        if (isNaN(quizId)) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language));
          await this.sendManageMixedQuizzesMenu(chatId, message, language);
          return;
        }
        const quiz = await this.quizService.findById(quizId);
        if (!quiz) {
          const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language));
          await this.sendManageMixedQuizzesMenu(chatId, message, language);
          return;
        }
        await this.quizService.deleteQuiz(quizId);
        const message = this.escapeMarkdown(
          this.i18nService.getTranslation('success.quiz_deleted', language, {
            question: quiz.questions[0]?.question[language] || 'N/A',
          }),
        );
        await this.sendManageMixedQuizzesMenu(chatId, message, language);
      }
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      const message = this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', language));
      await this.sendMessageWithAdminMenu(chatId, message, language);
      await bot.answerCallbackQuery(query.id);
    }
  }

  async sendMessageWithAdminMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
      parse_mode: 'MarkdownV2',
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
            { text: this.i18nService.getTranslation('quizzes.mixed_quizzes', language) },
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
        one_time_keyboard: false,
      },
    });
  }

  private async sendManageCoursesMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
      parse_mode: 'MarkdownV2',
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
        one_time_keyboard: false,
      },
    });
  }

  private async sendManageLessonsMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
      parse_mode: 'MarkdownV2',
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
        one_time_keyboard: false,
      },
    });
  }

  private async sendManageQuizzesMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
      parse_mode: 'MarkdownV2',
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
        one_time_keyboard: false,
      },
    });
  }

  private async sendManageMixedQuizzesMenu(chatId: number, message: string, language: string): Promise<void> {
    await this.telegramService.sendMessage(chatId, this.escapeMarkdown(message), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        keyboard: [
          [
            { text: this.i18nService.getTranslation('admin.create_mixed_quiz', language) },
            { text: this.i18nService.getTranslation('admin.view_mixed_quizzes', language) },
          ],
          [
            { text: this.i18nService.getTranslation('admin.delete_mixed_quiz', language) },
            { text: this.i18nService.getTranslation('admin.back', language) },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });
  }

  private parseMultipleCourseInput(input: string, language: string): CourseInput[] {
    const courses = input.split('\n---\n').map((item) => item.trim()).filter((item) => item);
    const result: CourseInput[] = [];
    for (const course of courses) {
      const lines = course.split('\n').map((line) => line.trim()).filter((line) => line);
      const data: CourseInput = {
        title_uz: '',
        title_ru: '',
        title_en: '',
        desc_uz: '',
        desc_ru: '',
        desc_en: '',
        price: 0,
      };
      lines.forEach((line) => {
        if (line.toLowerCase().startsWith('kurs nomi uz:')) data.title_uz = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('kurs nomi ru:')) data.title_ru = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('kurs nomi en:')) data.title_en = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('ta\'rif uz:')) data.desc_uz = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('ta\'rif ru:')) data.desc_ru = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('ta\'rif en:')) data.desc_en = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('narx:')) {
          const priceStr = line.split(':')[1]?.trim();
          data.price = priceStr ? parseInt(priceStr, 10) : 0;
        }
      });
      if (!data.title_uz || !data.title_ru || !data.title_en || !data.desc_uz || !data.desc_ru || !data.desc_en || isNaN(data.price)) {
        throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
      }
      result.push(data);
    }
    if (result.length === 0) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    return result;
  }

  private parseMultipleLessonInput(input: string, language: string): LessonInput[] {
    const lessons = input.split('\n---\n').map((item) => item.trim()).filter((item) => item);
    const result: LessonInput[] = [];
    for (const lesson of lessons) {
      const lines = lesson.split('\n').map((line) => line.trim()).filter((line) => line);
      const data: LessonInput = {
        title_uz: '',
        title_ru: '',
        title_en: '',
        contentType: '',
        contentUrl: '',
        order: 0,
      };
      lines.forEach((line) => {
        if (line.toLowerCase().startsWith('dars nomi uz:')) data.title_uz = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('dars nomi ru:')) data.title_ru = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('dars nomi en:')) data.title_en = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('kontent turi:')) data.contentType = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('kontent url:') || line.toLowerCase().startsWith('kontent havolasi:')) {
          data.contentUrl = line.split(':')[1]?.trim() || '';
        } else if (line.toLowerCase().startsWith('tartib:')) {
          const orderStr = line.split(':')[1]?.trim();
          data.order = orderStr ? parseInt(orderStr, 10) : 0;
        }
      });
      if (!data.title_uz || !data.title_ru || !data.title_en || !data.contentType || !data.contentUrl || isNaN(data.order)) {
        throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
      }
      result.push(data);
    }
    if (result.length === 0) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    return result;
  }

  private parseMultipleQuizInput(input: string, language: string): QuizInput[] {
    const quizzes = input.split('\n---\n').map((item) => item.trim()).filter((item) => item);
    const result: QuizInput[] = [];
    for (const quiz of quizzes) {
      const lines = quiz.split('\n').map((line) => line.trim()).filter((line) => line);
      const data: QuizInput = {
        question_uz: '',
        question_ru: '',
        question_en: '',
        options_uz: [],
        options_ru: [],
        options_en: [],
        correctAnswer: -1,
      };
      lines.forEach((line) => {
        if (line.toLowerCase().startsWith('savol uz:')) data.question_uz = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('savol ru:')) data.question_ru = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('savol en:')) data.question_en = line.split(':')[1]?.trim() || '';
        else if (line.toLowerCase().startsWith('variantlar uz:')) {
          data.options_uz = line
            .split(':')[1]
            ?.trim()
            .split(',')
            .map((opt) => opt.trim())
            .filter((opt) => opt) || [];
        } else if (line.toLowerCase().startsWith('variantlar ru:')) {
          data.options_ru = line
            .split(':')[1]
            ?.trim()
            .split(',')
            .map((opt) => opt.trim())
            .filter((opt) => opt) || [];
        } else if (line.toLowerCase().startsWith('variantlar en:')) {
          data.options_en = line
            .split(':')[1]
            ?.trim()
            .split(',')
            .map((opt) => opt.trim())
            .filter((opt) => opt) || [];
        } else if (line.toLowerCase().startsWith('to‘g‘ri javob:')) {
          const value = parseInt(line.split(':')[1]?.trim(), 10);
          data.correctAnswer = isNaN(value) ? -1 : value - 1;
        }
      });
      const isValid =
        data.question_uz &&
        data.question_ru &&
        data.question_en &&
        data.options_uz.length === 4 &&
        data.options_ru.length === 4 &&
        data.options_en.length === 4 &&
        data.correctAnswer >= 0 &&
        data.correctAnswer <= 3;
      if (!isValid) {
        throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
      }
      result.push(data);
    }
    if (result.length === 0) {
      throw new Error(this.i18nService.getTranslation('errors.invalid_input', language));
    }
    return result;
  }

  private escapeMarkdown(text: string): string {
    if (!text) return 'N/A';
    return text.replace(/([_*[\]()~`>#+\-=|{}\\.!])/g, '\\$1').replace(/\n/g, '\n');
  }
}