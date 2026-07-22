import { IsEmail, IsNumber, Min } from 'class-validator';

export class CreateCheckoutDto {
  @IsEmail()
  customerEmail!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}
