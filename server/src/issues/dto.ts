import { IsString, MaxLength } from 'class-validator';

export class CreateIssueDto {
  @IsString()
  @MaxLength(500, { message: 'Максимум 500 символов' })
  title: string;
}

export class UpdateIssueDto {
  @IsString()
  status: string;
}
