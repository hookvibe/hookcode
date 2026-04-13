import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import type { GlobalRobot, GlobalRobotWithTokenLike } from '../../types/globalRobot';
import type { RepoRobot } from '../../types/repoRobot';
import type { RepoRobotWithToken } from './repo-robot.service';
import type { TaskRobotSummary } from '../../types/task';
import { GlobalRobotService } from './global-robot.service';
import { RepoRobotService } from './repo-robot.service';

export type SharedRobot = RepoRobot | GlobalRobot;
export type SharedRobotWithToken = RepoRobotWithToken | GlobalRobotWithTokenLike;

@Injectable()
export class RobotCatalogService {
  constructor(
    private readonly repoRobotService: RepoRobotService,
    private readonly globalRobotService: GlobalRobotService
  ) {}

  async listAvailableByRepo(repoId: string): Promise<SharedRobot[]> {
    const [repoRobots, globalRobots] = await Promise.all([
      this.repoRobotService.listByRepo(repoId),
      this.globalRobotService.listEnabled()
    ]);
    // Keep mixed-scope pickers stable by returning repo robots first, then enabled global robots. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    return [...repoRobots, ...globalRobots];
  }

  async listAvailableByRepoWithToken(repoId: string): Promise<SharedRobotWithToken[]> {
    const [repoRobots, globalRobots] = await Promise.all([
      this.repoRobotService.listByRepoWithToken(repoId),
      this.globalRobotService.listEnabledWithConfig()
    ]);
    return [...repoRobots, ...globalRobots];
  }

  async getById(id: string): Promise<SharedRobot | null> {
    const repoRobot = await this.repoRobotService.getById(id);
    if (repoRobot) return repoRobot;
    return await this.globalRobotService.getById(id);
  }

  async getByIdWithToken(id: string): Promise<SharedRobotWithToken | null> {
    const repoRobot = await this.repoRobotService.getByIdWithToken(id);
    if (repoRobot) return repoRobot;
    const globalRobot = await this.globalRobotService.getByIdWithConfig(id);
    // Prevent disabled global robots from re-entering execution-oriented direct-id lookups even when the caller bypasses the enabled-only list endpoints. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    if (!globalRobot || !globalRobot.enabled) return null;
    return globalRobot;
  }

  async buildTaskRobotSummaryMap(robotIds: string[]): Promise<Map<string, TaskRobotSummary>> {
    const uniqueIds = Array.from(new Set(robotIds.map((value) => String(value).trim()).filter(Boolean)));
    if (!uniqueIds.length) return new Map();

    const [repoRows, globalRows] = await Promise.all([
      db.repoRobot.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, repoId: true, name: true, permission: true, enabled: true, modelProvider: true }
      }),
      db.globalRobot.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, name: true, permission: true, enabled: true, modelProvider: true }
      })
    ]);

    const entries: Array<[string, TaskRobotSummary]> = [
      ...repoRows.map((row): [string, TaskRobotSummary] => [
        String(row.id),
        {
          id: String(row.id),
          scope: 'repo' as const,
          repoId: String(row.repoId),
          name: String(row.name),
          permission: row.permission as TaskRobotSummary['permission'],
          modelProvider: row.modelProvider ? String(row.modelProvider) : undefined,
          enabled: Boolean(row.enabled)
        }
      ]),
      ...globalRows.map((row): [string, TaskRobotSummary] => [
        String(row.id),
        {
          id: String(row.id),
          scope: 'global' as const,
          name: String(row.name),
          permission: row.permission as TaskRobotSummary['permission'],
          modelProvider: row.modelProvider ? String(row.modelProvider) : undefined,
          enabled: Boolean(row.enabled)
        }
      ])
    ];
    return new Map(entries);
  }
}
