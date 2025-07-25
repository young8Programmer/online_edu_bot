import { Controller, Get, Param } from '@nestjs/common';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get(':telegramId/:courseId')
  async getProgress(@Param('telegramId') telegramId: string, @Param('courseId') courseId: string): Promise<{ completed: number; total: number }> {
    return this.progressService.getProgress(telegramId, parseInt(courseId, 10));
  }
}