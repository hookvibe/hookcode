export {};

jest.mock('../../agent/robots', () => ({
  getBotUsernames: jest.fn().mockReturnValue([])
}));

import { handleGithubWebhook, handleGitlabWebhook } from '../../modules/webhook/webhook.handlers';

const createDeps = () => ({
  repositoryService: {
    getByIdWithSecret: jest.fn(),
    markWebhookVerified: jest.fn(),
    updateRepository: jest.fn()
  },
  repoRobotService: {
    listByRepo: jest.fn().mockResolvedValue([])
  },
  repoAutomationService: {
    getConfig: jest.fn().mockResolvedValue({ version: 2, events: {} })
  },
  taskService: {
    createTask: jest.fn()
  },
  taskRunner: {
    trigger: jest.fn()
  },
  repoWebhookDeliveryService: {
    createDelivery: jest.fn().mockResolvedValue({ id: 'd1' })
  }
});

describe('Webhook repo binding (scope + identity)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Webhook ingress guard tests (Webhook module -> provider routing):
  // - Business behavior: wrong-provider headers should return WEBHOOK_PROVIDER_MISMATCH with a corrective hint.
  // - Change record (2026-01-15): added coverage for GitHub-on-GitLab and GitLab-on-GitHub misroutes.
  test('rejects GitHub webhook when it is sent to the GitLab endpoint', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        enabled: true,
        name: 'group/project',
        externalId: undefined,
        apiBaseUrl: undefined
      },
      webhookSecret: 's3cr3t'
    });

    const req = {
      params: { repoId: 'r1' },
      body: { zen: 'Accessible for all.' },
      header: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'x-github-event') return 'ping';
        if (key === 'x-hub-signature-256') return 'sha256=abc';
        if (key === 'user-agent') return 'GitHub-Hookshot/abc';
        return undefined;
      }
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGitlabWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WEBHOOK_PROVIDER_MISMATCH', expectedProvider: 'gitlab', detectedProvider: 'github' })
    );
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
  });

  test('rejects GitLab webhook when it is sent to the GitHub endpoint', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'r1',
        provider: 'github',
        enabled: true,
        name: 'group/project',
        externalId: undefined,
        apiBaseUrl: undefined
      },
      webhookSecret: 's3cr3t'
    });

    const req = {
      params: { repoId: 'r1' },
      body: { project: { id: 123, path_with_namespace: 'group/project', web_url: 'https://gitlab.example.com/group/project' } },
      header: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'x-gitlab-event') return 'Push Hook';
        if (key === 'x-gitlab-token') return 's3cr3t';
        if (key === 'x-gitlab-event-uuid') return 'uuid-1';
        return undefined;
      }
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGithubWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WEBHOOK_PROVIDER_MISMATCH', expectedProvider: 'github', detectedProvider: 'gitlab' })
    );
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
  });

  test('accepts GitLab webhook when repo.name is a slug and payload ends with the same slug', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        enabled: true,
        name: 'project',
        externalId: undefined,
        apiBaseUrl: undefined
      },
      webhookSecret: 's3cr3t'
    });

    const req = {
      params: { repoId: 'r1' },
      body: { project: { id: 123, path_with_namespace: 'group/project', web_url: 'https://gitlab.example.com/group/project' } },
      header: (name: string) => (name.toLowerCase() === 'x-gitlab-token' ? 's3cr3t' : undefined)
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGitlabWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(deps.repositoryService.markWebhookVerified).toHaveBeenCalledWith('r1');
  });

  test('rejects GitLab webhook when repo.name is a slug but payload repo slug mismatches', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        enabled: true,
        name: 'project',
        externalId: undefined,
        apiBaseUrl: undefined
      },
      webhookSecret: 's3cr3t'
    });

    const req = {
      params: { repoId: 'r1' },
      body: { project: { id: 123, path_with_namespace: 'group/other', web_url: 'https://gitlab.example.com/group/other' } },
      header: (name: string) => (name.toLowerCase() === 'x-gitlab-token' ? 's3cr3t' : undefined)
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGitlabWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'WEBHOOK_REPO_NAME_MISMATCH' }));
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
  });

  test('rejects GitLab webhook when repo.externalId is empty but repo.name mismatches payload path', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        enabled: true,
        name: 'group/project',
        externalId: undefined,
        apiBaseUrl: undefined
      },
      webhookSecret: 's3cr3t'
    });

    const req = {
      params: { repoId: 'r1' },
      body: { project: { id: 123, path_with_namespace: 'group/other', web_url: 'https://gitlab.example.com/group/other' } },
      header: (name: string) => (name.toLowerCase() === 'x-gitlab-token' ? 's3cr3t' : undefined)
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGitlabWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'WEBHOOK_REPO_NAME_MISMATCH' }));
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
    expect(deps.repositoryService.updateRepository).not.toHaveBeenCalled();
  });

  test('rejects GitLab webhook when project id mismatches repo.externalId', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        enabled: true,
        name: 'group/project',
        externalId: '123',
        apiBaseUrl: 'https://gitlab.example.com'
      },
      webhookSecret: 's3cr3t'
    });
    deps.repositoryService.markWebhookVerified.mockResolvedValue(true);

    const req = {
      params: { repoId: 'r1' },
      body: { project: { id: 999, web_url: 'https://gitlab.example.com/group/other' } },
      header: (name: string) => (name.toLowerCase() === 'x-gitlab-token' ? 's3cr3t' : undefined)
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGitlabWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
    expect(deps.repositoryService.updateRepository).not.toHaveBeenCalled();
  });

  test('rejects GitLab System Hook requests', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        enabled: true,
        name: 'group/project',
        externalId: '123',
        apiBaseUrl: 'https://gitlab.example.com'
      },
      webhookSecret: 's3cr3t'
    });

    const req = {
      params: { repoId: 'r1' },
      body: {},
      header: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'x-gitlab-event') return 'System Hook';
        if (key === 'x-gitlab-token') return 's3cr3t';
        return undefined;
      }
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGitlabWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'WEBHOOK_SCOPE_NOT_SUPPORTED' }));
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
  });

  test('rejects GitLab webhook when payload is missing project identity', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        enabled: true,
        name: 'group/project',
        externalId: undefined,
        apiBaseUrl: undefined
      },
      webhookSecret: null
    });

    const req = { params: { repoId: 'r1' }, body: {}, header: () => undefined } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGitlabWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'WEBHOOK_REPO_ID_MISSING' }));
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
  });

  test('rejects GitHub webhook when repo.name is a slug but payload repo slug mismatches', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'g1',
        provider: 'github',
        enabled: true,
        name: 'repo',
        externalId: undefined,
        apiBaseUrl: undefined
      },
      webhookSecret: null
    });

    const req = {
      params: { repoId: 'g1' },
      body: { repository: { id: 1, full_name: 'octo/other', html_url: 'https://github.com/octo/other' } },
      header: () => undefined
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGithubWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'WEBHOOK_REPO_NAME_MISMATCH' }));
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
  });

  test('rejects GitHub webhook when repository identity mismatches', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'g1',
        provider: 'github',
        enabled: true,
        name: 'octo/repo',
        externalId: 'octo/repo',
        apiBaseUrl: 'https://api.github.com'
      },
      webhookSecret: null
    });

    const req = {
      params: { repoId: 'g1' },
      body: { repository: { id: 1, full_name: 'octo/other', html_url: 'https://github.com/octo/other' } },
      header: () => undefined
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGithubWebhook(req, res, deps as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(deps.repositoryService.markWebhookVerified).not.toHaveBeenCalled();
    expect(deps.repositoryService.updateRepository).not.toHaveBeenCalled();
  });

  test('accepts GitHub webhook when repo.externalId is numeric id and payload contains the same id', async () => {
    const deps = createDeps();
    deps.repositoryService.getByIdWithSecret.mockResolvedValue({
      repo: {
        id: 'g1',
        provider: 'github',
        enabled: true,
        name: 'octo/repo',
        externalId: '12345',
        apiBaseUrl: 'https://api.github.com'
      },
      webhookSecret: null
    });
    deps.repositoryService.markWebhookVerified.mockResolvedValue(true);

    const req = {
      params: { repoId: 'g1' },
      body: {
        repository: {
          id: 12345,
          full_name: 'octo/repo',
          html_url: 'https://github.com/octo/repo'
        }
      },
      header: () => undefined
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGithubWebhook(req, res, deps as any);

    expect(deps.repositoryService.markWebhookVerified).toHaveBeenCalledWith('g1');
    expect(res.status).toHaveBeenCalledWith(202);
  });
});
