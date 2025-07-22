import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Course } from '../course/course.entity';

@Entity()
export class Lesson {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Course, (course) => course.id)
  course: Course;

  @Column('jsonb')
  title: { uz: string; ru: string; en: string };

  @Column()
  contentType: string;

  @Column()
  contentUrl: string;

  @Column()
  order: number;

  @CreateDateColumn()
  createdAt: Date;
}