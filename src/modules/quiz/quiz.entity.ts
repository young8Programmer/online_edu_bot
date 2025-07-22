import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Course } from '../course/course.entity';

@Entity()
export class Quiz {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Course)
  course: Course;

  @Column('jsonb')
  question: { uz: string; ru: string; en: string };

  @Column('jsonb')
  options: { uz: string[]; ru: string[]; en: string[] };

  @Column()
  correctAnswer: number;
}