import { Injectable } from '@nestjs/common';
import { ProgressService } from '../progress.service';
import { UserService } from '../../user/user.service';
import { LessonService } from '../../lesson/lesson.service';

@Injectable()
export class UpdateProgressHandler {
  constructor(
    private readonly progressService: ProgressService,
    private readonly userService: UserService,
    private readonly lessonService: LessonService,
  ) {}

  async handle(telegramId: string, lessonId: number): Promise<void> {
    await this.progressService.updateProgress(telegramId, lessonId);
  }
}