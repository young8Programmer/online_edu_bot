import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Course } from '../course/course.entity';

@Entity()
export class Certificate {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @ManyToOne(() => Course, (course) => course.id)
  course: Course;

  @Column({ type: 'bytea', nullable: true }) // Yangi: pdf fayl xotirada saqlanadi
  pdfBuffer: Buffer;

  @CreateDateColumn()
  issuedAt: Date;
}
