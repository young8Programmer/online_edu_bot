import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Lesson } from '../lesson/lesson.entity';

@Entity()
export class Progress {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @ManyToOne(() => Lesson, (lesson) => lesson.id)
  lesson: Lesson;

  @Column()
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}