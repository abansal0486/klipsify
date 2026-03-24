import { Expose, Transform } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  _id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  phone: string;

  @Expose()
  emailVerified: boolean;

  @Expose()
  role: 'user' | 'admin';

  @Expose()
  country?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}