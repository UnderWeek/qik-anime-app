import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto';

const PASTEL_COLORS = [
  '#A8D8C9',
  '#F7C9D9',
  '#C9D6F0',
  '#F5E1A4',
  '#D9C2F0',
  '#BFE3D0',
  '#F0C9B8',
];

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: { id: number; username: string }) {
    return this.jwt.sign({ sub: user.id, username: user.username });
  }

  async register(dto: RegisterDto) {
    const existsEmail = await this.users.findByEmail(dto.email);
    if (existsEmail) throw new ConflictException('Email уже занят');

    const existsName = await this.users.findByUsername(dto.username);
    if (existsName) throw new ConflictException('Никнейм уже занят');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const avatarColor =
      PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];

    const user = await this.users.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      avatarColor,
    });

    return {
      token: this.sign(user),
      user: this.users.toPublic(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByLogin(dto.login);
    if (!user) throw new UnauthorizedException('Неверный логин или пароль');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Неверный логин или пароль');

    return {
      token: this.sign(user),
      user: this.users.toPublic(user),
    };
  }

  async me(id: number) {
    const user = await this.users.findById(id);
    return this.users.toPublic(user);
  }
}
