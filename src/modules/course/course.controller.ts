import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
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
  async findById(@Param('id') id: string): Promise<Course> {
    const course = await this.courseService.findById(parseInt(id, 10));
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }
}