import { Injectable } from '@nestjs/common';
import { setAgentServices, callAgent, buildRemoteExecutionBundle, postRemoteExecutionResult } from '../../agent/agent';
import { Task } from '../../types/task';
import { RepositoryService } from '../repositories/repository.service';
import { RepoRobotService } from '../repositories/repo-robot.service';
import { UserService } from '../users/user.service';
import { UserApiTokenService } from '../users/user-api-token.service';
import { TaskLogStream } from './task-log-stream.service';
import { TaskLogsService } from './task-logs.service';
import { TaskService } from './task.service';
import { RuntimeService } from '../../services/runtimeService';
import { HookcodeConfigService } from '../../services/hookcodeConfigService';
import { SkillsService } from '../skills/skills.service';

@Injectable()
export class AgentService {
  constructor(
    taskService: TaskService,
    taskLogStream: TaskLogStream,
    taskLogsService: TaskLogsService,
    repositoryService: RepositoryService,
    repoRobotService: RepoRobotService,
    userService: UserService,
    // Provide PAT issuance to the agent runtime for task-group .env generation. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    userApiTokenService: UserApiTokenService,
    runtimeService: RuntimeService,
    hookcodeConfigService: HookcodeConfigService,
    skillsService: SkillsService
  ) {
    // Register dependency-related services with the agent runtime. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    setAgentServices({
      taskService,
      taskLogStream,
      taskLogsService, // Wire task-log persistence for DB-backed log storage. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      repositoryService,
      repoRobotService,
      userService,
      userApiTokenService,
      runtimeService,
      hookcodeConfigService,
      skillsService // Provide skill registry access for prompt injection. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    });
  }

  callAgent(task: Task, options?: { signal?: AbortSignal }) {
    // Forward abort signals so task runner can pause/stop executions. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    return callAgent(task, options);
  }

  buildRemoteExecutionBundle(task: Task) {
    // Keep remote execution planning on the backend so workers only receive an already-resolved execution bundle.
    return buildRemoteExecutionBundle(task);
  }

  postRemoteExecutionResult(task: Task, params: { status: 'succeeded' | 'failed'; outputText?: string; message?: string }) {
    // Let backend-owned provider clients publish remote worker results so worker nodes do not need repo-provider tokens or API clients.
    return postRemoteExecutionResult(task, params);
  }
}
