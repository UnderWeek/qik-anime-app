import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;
}

export class StartChatDto {
  @IsInt()
  friendId: number;
}
