import { Transform, Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export interface DailyCompletedCount {
  date: string;
  count: number;
}

export interface CompletedSummaryResponse {
  total: number;
  dailyCounts: DailyCompletedCount[];
}

const toDate = (params: { value: string }) => {
  const { value } = params;

  if (value && !isNaN(new Date(value).getTime())) {
    return new Date(value);
  }

  return value;
};

export class GetCompletedSummaryDto {
  @IsOptional()
  @Transform(toDate)
  @IsDate({ message: 'startDate must be a valid date.' })
  startDate: Date;

  @IsOptional()
  @Transform(toDate)
  @Type(() => Date)
  @IsDate({ message: 'endDate must be a valid date.' })
  endDate: Date;

  @IsOptional()
  @IsUUID('4', { message: 'userId must be a valid UUID.' })
  userId?: string;
}
