// Unit coverage for task-group workspace path builder. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
export {};

import path from 'path';
import os from 'os';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
// Include task-group env resolution helpers for workspace coverage. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
import {
  buildTaskGroupAgentsContent,
  buildTaskGroupClaudeContent,
  buildTaskGroupEnvFileContents,
  buildTaskGroupGeminiContent,
  buildTaskGroupRootDir,
  buildTaskGroupWorkspaceDir,
  __test__buildCodexSchemaContents,
  __test__buildTaskGroupWorkspacePromptPrefix,
  __test__ensureTaskGroupTemplateDir,
  __test__ensureTaskGroupPat,
  __test__readCodexOutputSchema,
  __test__resolveTaskGroupApiBaseUrl,
  __test__syncTaskGroupSkillEnvFiles,
  setAgentServices,
  TASK_GROUP_WORKSPACE_ROOT
} from '../../agent/agent';

describe('buildTaskGroupWorkspaceDir', () => {
  test('maps task group ids to root directories', () => {
    const result = buildTaskGroupRootDir({ taskGroupId: 'group-root', taskId: 'task-root' });

    // Keep task-group root directories stable for shared artifacts. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(result).toBe(path.join(TASK_GROUP_WORKSPACE_ROOT, 'group-root'));
  });

  test('renders task-group env file contents with API + PAT values', () => {
    const envContents = buildTaskGroupEnvFileContents({
      apiBaseUrl: 'http://localhost:4000',
      pat: 'hcpat_test',
      taskGroupId: 'group-123'
    });

    // Ensure .env output embeds the supplied credentials for task-group tooling. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(envContents).toContain('HOOKCODE_API_BASE_URL=http://localhost:4000');
    expect(envContents).toContain('HOOKCODE_PAT=hcpat_test');
    expect(envContents).toContain('HOOKCODE_TASK_GROUP_ID=group-123');
  });

  // Share guidance template builders for AGENTS/CLAUDE/GEMINI coverage. docs/en/developer/plans/gemini-claude-agents-20260205/task_plan.md gemini-claude-agents-20260205
  const guidanceTemplateBuilders = [
    { label: 'AGENTS', builder: buildTaskGroupAgentsContent },
    { label: 'CLAUDE', builder: buildTaskGroupClaudeContent },
    { label: 'GEMINI', builder: buildTaskGroupGeminiContent }
  ];

  guidanceTemplateBuilders.forEach(({ label, builder }) => {
    test(`embeds env contents verbatim in task-group ${label} template`, () => {
      const envContents = buildTaskGroupEnvFileContents({
        apiBaseUrl: 'http://localhost:4000',
        pat: 'hcpat_test',
        taskGroupId: 'group-123'
      });
      const templateContents = builder({ envFileContents: envContents, repoFolderName: 'repo' });

      // Validate AGENTS/CLAUDE/GEMINI templates embed env content and repo guidance. docs/en/developer/plans/gemini-claude-agents-20260205/task_plan.md gemini-claude-agents-20260205
      expect(templateContents).toContain(envContents);
      expect(templateContents).toContain('Operate only inside the git-cloned repository folder');
      expect(templateContents).toContain('<<repo>>');
    });
  });

  test('uses task group id when available', () => {
    const result = buildTaskGroupWorkspaceDir({
      taskGroupId: 'group-123',
      taskId: 'task-ignored',
      provider: 'github',
      repoSlug: 'org__repo'
    });

    // Ensure task group ids drive the root path while repo name lives under the group. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(result).toBe(path.join(TASK_GROUP_WORKSPACE_ROOT, 'group-123', 'repo'));
  });

  test('falls back to task id when group id is missing', () => {
    const result = buildTaskGroupWorkspaceDir({
      taskGroupId: null,
      taskId: 'task-789',
      provider: 'gitlab',
      repoSlug: 'space__repo'
    });

    // Maintain deterministic fallback paths when task group ids are unavailable. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(result).toBe(path.join(TASK_GROUP_WORKSPACE_ROOT, 'task-789', 'repo'));
  });
});

describe('task-group workspace prompt prefix', () => {
  test('includes workspace root and repo folder guidance', () => {
    const prefix = __test__buildTaskGroupWorkspacePromptPrefix({
      taskGroupDir: '/tmp/task-groups/tg-123',
      repoFolderName: 'demo-repo'
    });

    // Ensure Claude prompt prefix surfaces workspace cwd expectations. docs/en/developer/plans/gemini-claude-agents-20260205/task_plan.md gemini-claude-agents-20260205
    expect(prefix).toContain('Workspace root (cwd): /tmp/task-groups/tg-123');
    expect(prefix).toContain('Repository folder: demo-repo');
    expect(prefix).toContain('workspace root as the current working directory');
  });
});

describe('task-group template helpers', () => {
  test('copies Claude/Gemini templates into the task-group root', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hookcode-taskgroup-templates-'));

    try {
      // Ensure provider template directories are seeded alongside .codex for CLI runs. docs/en/developer/plans/gemini-claude-agents-20260205/task_plan.md gemini-claude-agents-20260205
      await __test__ensureTaskGroupTemplateDir({ taskGroupDir: tempDir, templateName: '.claude', requiredSubdirs: ['skills'] });
      await __test__ensureTaskGroupTemplateDir({ taskGroupDir: tempDir, templateName: '.gemini', requiredSubdirs: ['skills'] });

      await expect(stat(path.join(tempDir, '.claude', 'skills'))).resolves.toBeDefined();
      await expect(stat(path.join(tempDir, '.gemini', 'skills'))).resolves.toBeDefined();
      await expect(stat(path.join(tempDir, '.claude', 'skills', 'hookcode-preview-highlight'))).resolves.toBeDefined();
      await expect(stat(path.join(tempDir, '.gemini', 'skills', 'hookcode-preview-highlight'))).resolves.toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('codex schema helpers', () => {
  test('builds default codex-schema contents with output and next_actions', () => {
    // Validate the default Codex output schema payload for task-group initialization. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    const contents = __test__buildCodexSchemaContents();
    const parsed = JSON.parse(contents);
    expect(parsed).toMatchObject({
      type: 'object',
      properties: {
        output: { type: 'string' },
        next_actions: { type: 'array' }
      },
      additionalProperties: false
    });
    expect(parsed.required).toEqual(expect.arrayContaining(['output', 'next_actions']));
  });

  test('reads codex-schema.json when valid and skips invalid JSON', async () => {
    // Ensure codex-schema parsing is resilient and logs invalid payloads without throwing. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hookcode-taskgroup-schema-'));
    const schemaPath = path.join(tempDir, 'codex-schema.json');
    const logs: string[] = [];
    const appendLog = async (line: string) => {
      // Capture codex-schema parse logs for assertion without returning a value. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      logs.push(line);
    };

    try {
      const schema = { type: 'object', properties: { output: { type: 'string' } }, required: ['output'], additionalProperties: false };
      await writeFile(schemaPath, JSON.stringify(schema), 'utf8');
      await expect(__test__readCodexOutputSchema({ taskGroupDir: tempDir, appendLog })).resolves.toEqual(schema);

      await writeFile(schemaPath, '{ invalid json', 'utf8');
      await expect(__test__readCodexOutputSchema({ taskGroupDir: tempDir, appendLog })).resolves.toBeUndefined();
      expect(logs.some((line) => line.includes('codex-schema.json'))).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('resolveTaskGroupApiBaseUrl', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  test('prefers explicit HOOKCODE_API_BASE_URL and strips /api suffix', () => {
    process.env.HOOKCODE_API_BASE_URL = 'http://localhost:4000/api';
    process.env.OPENAPI_BASE_URL = 'http://example.com/api';

    // Keep task-group env base URLs aligned with host roots for skill usage. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(__test__resolveTaskGroupApiBaseUrl()).toBe('http://localhost:4000');
  });

  test('falls back to HOST/PORT when explicit base is missing', () => {
    delete process.env.HOOKCODE_API_BASE_URL;
    delete process.env.OPENAPI_BASE_URL;
    delete process.env.ADMIN_TOOLS_API_BASE_URL;
    process.env.HOST = '127.0.0.1';
    process.env.PORT = '4555';

    // Ensure host/port config still yields a usable API base URL. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(__test__resolveTaskGroupApiBaseUrl()).toBe('http://127.0.0.1:4555');
  });
});

describe('syncTaskGroupSkillEnvFiles', () => {
  test('copies task-group env contents into each skill folder', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hookcode-taskgroup-'));
    const skillsRoot = path.join(tempDir, '.codex', 'skills');
    const envContents = 'HOOKCODE_API_BASE_URL=http://localhost:4000\nHOOKCODE_PAT=hcpat_test\n';

    try {
      await mkdir(path.join(skillsRoot, 'skill-a'), { recursive: true });
      await mkdir(path.join(skillsRoot, 'skill-b'), { recursive: true });
      await writeFile(path.join(skillsRoot, 'skill-b', '.env'), 'stale', 'utf8');

      // Keep per-skill env files aligned with the task-group .env. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      await __test__syncTaskGroupSkillEnvFiles({ taskGroupDir: tempDir, envContents });

      await expect(readFile(path.join(skillsRoot, 'skill-a', '.env'), 'utf8')).resolves.toBe(envContents);
      await expect(readFile(path.join(skillsRoot, 'skill-b', '.env'), 'utf8')).resolves.toBe(envContents);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('ensureTaskGroupPat', () => {
  test('reuses existing PATs that include tasks:write scope', async () => {
    const verifyToken = jest.fn().mockResolvedValue({
      auth: { tokenType: 'pat', sub: 'user-1', iat: 0, scopes: { tasks: 'write' } },
      userId: 'user-1'
    });
    const createToken = jest.fn().mockResolvedValue({ token: 'hcpat_new', apiToken: {} });
    const userService = {
      getDefaultUserCredentialsRaw: jest.fn().mockResolvedValue({ userId: 'user-1' }),
      ensureBootstrapUser: jest.fn().mockResolvedValue(undefined)
    };

    // Provide PAT services so task-group env generation can verify scopes. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    setAgentServices({
      taskService: {} as any,
      taskLogStream: { publish: jest.fn(), subscribe: jest.fn() } as any,
      repositoryService: {} as any,
      repoRobotService: {} as any,
      userService: userService as any,
      userApiTokenService: { verifyToken, createToken } as any,
      runtimeService: {} as any,
      hookcodeConfigService: {} as any
    });

    await expect(__test__ensureTaskGroupPat({ taskGroupId: 'tg-1', existingPat: 'hcpat_existing' })).resolves.toBe(
      'hcpat_existing'
    );
    expect(createToken).not.toHaveBeenCalled();
  });

  test('issues new PATs when existing scopes are insufficient', async () => {
    const verifyToken = jest.fn().mockResolvedValue({
      auth: { tokenType: 'pat', sub: 'user-1', iat: 0, scopes: { tasks: 'read' } },
      userId: 'user-1'
    });
    const createToken = jest.fn().mockResolvedValue({ token: 'hcpat_new', apiToken: {} });
    const userService = {
      getDefaultUserCredentialsRaw: jest.fn().mockResolvedValue({ userId: 'user-1' }),
      ensureBootstrapUser: jest.fn().mockResolvedValue(undefined)
    };

    // Rotate task-group PATs when they lack tasks:write scope. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    setAgentServices({
      taskService: {} as any,
      taskLogStream: { publish: jest.fn(), subscribe: jest.fn() } as any,
      repositoryService: {} as any,
      repoRobotService: {} as any,
      userService: userService as any,
      userApiTokenService: { verifyToken, createToken } as any,
      runtimeService: {} as any,
      hookcodeConfigService: {} as any
    });

    await expect(__test__ensureTaskGroupPat({ taskGroupId: 'tg-2', existingPat: 'hcpat_existing' })).resolves.toBe(
      'hcpat_new'
    );
    expect(createToken).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'task-group-tg-2',
        scopes: [{ group: 'tasks', level: 'write' }],
        expiresInDays: 0
      })
    );
  });
});
