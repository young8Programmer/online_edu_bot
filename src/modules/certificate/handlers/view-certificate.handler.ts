import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { CertificateService } from '../certificate.service';
import * as TelegramBot from 'node-telegram-bot-api';
import { format } from 'date-fns';

@Injectable()
export class ViewCertificatesHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly certificateService: CertificateService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    const certificates = await this.certificateService.getCertificates(telegramId);
    if (!certificates.length) {
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('certificates.no_certificates', language), language, telegramId);
      return;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: certificates.map((cert) => [
          {
            text: this.i18nService.getTranslation('certificates.info', language, {
              course: cert.course?.title?.[language] || 'Unknown',
              date: format(cert.issuedAt || new Date(), 'dd/MM/yyyy'),
            }),
            callback_data: `download_certificate_${cert.id}`,
          },
        ]).concat([[{ text: this.i18nService.getTranslation('menu.back', language), callback_data: 'menu' }]]),
      },
    };

    await bot.sendMessage(chatId, this.i18nService.getTranslation('certificates.list', language), keyboard);
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';
    const certificateId = parseInt(query.data.split('_')[2], 10);

    const certificate = await this.certificateService.getCertificateById(certificateId);
    if (!certificate) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.certificate_not_found', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    await bot.sendDocument(chatId, certificate.pdfBuffer, {
      filename: `certificate_${certificate.course.id}_${telegramId}.pdf`,
      content_type: 'application/pdf',
      caption: this.i18nService.getTranslation('certificates.certificate_caption', language, { title: certificate.course.title[language] }),
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: this.i18nService.getTranslation('menu.back', language), callback_data: 'menu' }]],
      },
    });

    await bot.answerCallbackQuery(query.id);
  }
}