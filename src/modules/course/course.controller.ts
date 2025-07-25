import { Controller, Get, Param, Post, Body, Delete } from '@nestjs/common';
import { CourseService } from './course.service';
import { Course } from './course.entity';

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  async findAll(): Promise<Course[]> {
    return this.courseService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Course | null> {
    return this.courseService.findById(parseInt(id, 10));
  }

  @Post()
  async create(@Body() data: {
    title: { uz: string; ru: string; en: string };
    description: { uz: string; ru: string; en: string };
    isPaid: boolean;
    price?: number;
    category?: string;
  }): Promise<Course> {
    return this.courseService.createCourse(data);
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() data: {
    title?: { uz: string; ru: string; en: string };
    description?: { uz: string; ru: string; en: string };
    isPaid?: boolean;
    price?: number;
    category?: string;
  }): Promise<void> {
    await this.courseService.updateCourse(parseInt(id, 10), data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.courseService.deleteCourse(parseInt(id, 10));
  }
}