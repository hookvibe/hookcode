import { ApiProperty } from '@nestjs/swagger';
import { TaskGroupWithMetaDto } from './task-groups-swagger.dto';
import { TaskWithMetaDto } from './tasks-swagger.dto';

export class ChatExecuteRequestDto {
  @ApiProperty({
    description: 'Target repository id (UUID).',
    example: '11111111-1111-1111-1111-111111111111'
  })
  repoId!: string;

  @ApiProperty({
    description: 'Robot id (UUID) selected by the user.',
    example: '22222222-2222-2222-2222-222222222222'
  })
  robotId!: string;

  @ApiProperty({
    description: 'User input text to be executed as a task.',
    example: 'Please review the code style and suggest improvements.'
  })
  text!: string;

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

