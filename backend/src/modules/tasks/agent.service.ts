import { Injectable } from '@nestjs/common';
import { setAgentServices, callAgent } from '../../agent/agent';
import { Task } from '../../types/task';
import { RepositoryService } from '../repositories/repository.service';
import { RepoRobotService } from '../repositories/repo-robot.service';
import { UserService } from '../users/user.service';
import { TaskLogStream } from './task-log-stream.service';
import { TaskService } from './task.service';

@Injectable()
export class AgentService {
  constructor(
    taskService: TaskService,
    taskLogStream: TaskLogStream,
    repositoryService: RepositoryService,
    repoRobotService: RepoRobotService,
    userService: UserService
  ) {
    setAgentServices({ taskService, taskLogStream, repositoryService, repoRobotService, userService });
  }

  callAgent(task: Task) {
    return callAgent(task);
  }
}

