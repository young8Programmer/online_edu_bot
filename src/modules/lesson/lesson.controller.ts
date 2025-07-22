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
  async findById(@Param('id') id: string): Promise<Lesson> {
    const lesson = await this.lessonService.findById(parseInt(id, 10));
    if (!lesson) {
      throw new Error('Dars topilmadi');
    }
    return lesson;
  }

  @Post()
  async create(@Body() data: { courseId: number; title: { uz: string; ru: string; en: string }; contentType: string; contentUrl: string; order: number }): Promise<Lesson> {
    return this.lessonService.createLesson(data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.lessonService.deleteLesson(parseInt(id, 10));
  }
}