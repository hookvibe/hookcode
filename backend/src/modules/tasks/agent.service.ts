import { Injectable } from '@nestjs/common';
import { setAgentServices, callAgent } from '../../agent/agent';
import { Task } from '../../types/task';
import { RepositoryService } from '../repositories/repository.service';
import { RepoRobotService } from '../repositories/repo-robot.service';
import { UserService } from '../users/user.service';
import { TaskLogStream } from './task-log-stream.service';
import { TaskService } from './task.service';
import { RuntimeService } from '../../services/runtimeService';
import { HookcodeConfigService } from '../../services/hookcodeConfigService';

@Injectable()
export class AgentService {
  constructor(
    taskService: TaskService,
    taskLogStream: TaskLogStream,
    repositoryService: RepositoryService,
    repoRobotService: RepoRobotService,
    userService: UserService,
    runtimeService: RuntimeService,
    hookcodeConfigService: HookcodeConfigService
  ) {
    // Register dependency-related services with the agent runtime. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    setAgentServices({
      taskService,
      taskLogStream,
      repositoryService,
      repoRobotService,
      userService,
      runtimeService,
      hookcodeConfigService
    });
  }

  callAgent(task: Task) {
    return callAgent(task);
  }
}
