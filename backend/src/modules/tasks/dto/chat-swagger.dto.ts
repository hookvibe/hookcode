import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TaskGroupWithMetaDto } from './task-groups-swagger.dto';
import { TaskWithMetaDto } from './tasks-swagger.dto';

export class ChatExecuteRequestDto {
  // Ensure ValidationPipe whitelist keeps chat request fields for /chat. docs/en/developer/plans/2w8gp733clurvugsxkme/task_plan.md 2w8gp733clurvugsxkme
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Target repository id (UUID).',
    example: '11111111-1111-1111-1111-111111111111'
  })
  repoId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Robot id (UUID) selected by the user.',
    example: '22222222-2222-2222-2222-222222222222'
  })
  robotId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'User input text to be executed as a task.',
    example: 'Please review the code style and suggest improvements.'
  })
  text!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description:
      'Optional existing taskGroupId to continue execution within the same task group/thread.'
  })
  taskGroupId?: string;
}

export class ChatExecuteResponseDto {
  @ApiProperty({ type: TaskGroupWithMetaDto })
  taskGroup!: TaskGroupWithMetaDto;

  @ApiProperty({ type: TaskWithMetaDto })
  task!: TaskWithMetaDto;
}
