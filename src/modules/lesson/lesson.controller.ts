import { Controller, Get, Param, Post, Body, Delete } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { Lesson } from './lesson.entity';

@Controller('lessons')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Get('course/:courseId')
  async findByCourseId(@Param('courseId') courseId: string): Promise<Lesson[]> {
    return this.lessonService.findByCourseId(parseInt(courseId, 10));
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Lesson | null> {
    return this.lessonService.findById(parseInt(id, 10));
  }

  @Post()
  async create(@Body() data: {
    courseId: number;
    title: { uz: string; ru: string; en: string };
    contentType: string;
    contentUrl: string;
    order: number;
  }): Promise<Lesson> {
    return this.lessonService.createLesson(data);
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() data: {
    title?: { uz: string; ru: string; en: string };
    contentType?: string;
    contentUrl?: string;
    order?: number;
  }): Promise<void> {
    await this.lessonService.updateLesson(parseInt(id, 10), data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.lessonService.deleteLesson(parseInt(id, 10));
  }
}