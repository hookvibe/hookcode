import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskRepoSummaryDto, TaskRobotSummaryDto, TaskWithMetaDto } from './tasks-swagger.dto';

export class TaskGroupWithMetaDto {
  @ApiProperty()
  id!: string;

  // Change record: add `chat` for the console manual-trigger task group type.
  @ApiProperty({ enum: ['issue', 'merge_request', 'commit', 'task', 'chat'] })
  kind!: 'issue' | 'merge_request' | 'commit' | 'task' | 'chat';

  @ApiProperty()
  bindingKey!: string;

  @ApiPropertyOptional({ nullable: true })
  threadId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  title?: string | null;

  @ApiPropertyOptional({ enum: ['gitlab', 'github'], nullable: true })
  repoProvider?: 'gitlab' | 'github' | null;

  @ApiPropertyOptional({ nullable: true })
  repoId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  robotId?: string | null;

  @ApiPropertyOptional()
  issueId?: number;

  @ApiPropertyOptional()
  mrId?: number;

  @ApiPropertyOptional({ nullable: true })
  commitSha?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: TaskRepoSummaryDto })
  repo?: TaskRepoSummaryDto;

  @ApiPropertyOptional({ type: TaskRobotSummaryDto })
  robot?: TaskRobotSummaryDto;
}

export class ListTaskGroupsResponseDto {
  @ApiProperty({ type: TaskGroupWithMetaDto, isArray: true })
  taskGroups!: TaskGroupWithMetaDto[];
}

export class GetTaskGroupResponseDto {
  @ApiProperty({ type: TaskGroupWithMetaDto })
  taskGroup!: TaskGroupWithMetaDto;
}

export class ListTasksByGroupResponseDto {
  @ApiProperty({ type: TaskWithMetaDto, isArray: true })
  tasks!: TaskWithMetaDto[];
}
