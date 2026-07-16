import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @IsString()
  @MinLength(3, { message: 'Никнейм минимум 3 символа' })
  @MaxLength(24, { message: 'Никнейм максимум 24 символа' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Только латиница, цифры и _ . -',
  })
  username: string;

  @IsString()
  @MinLength(6, { message: 'Пароль минимум 6 символов' })
  @MaxLength(72)
  password: string;
}

export class LoginDto {
  @IsString()
  login: string; // email or username

  @IsString()
  password: string;
}
