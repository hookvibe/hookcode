export {};

jest.mock('../../agent/robots', () => ({
  getBotUsernames: jest.fn().mockReturnValue([])
}));

import { handleGitlabWebhook } from '../../modules/webhook/webhook.handlers';

describe('Webhook verification marker', () => {
  test('marks repo webhook as verified after a valid GitLab webhook request', async () => {
    const deps = {
      repositoryService: {
        getByIdWithSecret: jest.fn().mockResolvedValue({
          repo: {
            id: 'r1',
            provider: 'gitlab',
            enabled: true,
            name: 'group/project',
            externalId: '123',
            apiBaseUrl: 'https://gitlab.example.com',
            branches: [{ name: 'main', isDefault: true }]
          },
          webhookSecret: 's3cr3t'
        }),
        markWebhookVerified: jest.fn().mockResolvedValue(true),
        updateRepository: jest.fn().mockResolvedValue({ repo: null })
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
    } as any;

    const req = {
      params: { repoId: 'r1' },
      body: { project: { id: 123, web_url: 'https://gitlab.example.com/group/project' } },
      header: (name: string) => (name.toLowerCase() === 'x-gitlab-token' ? 's3cr3t' : undefined)
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;

    await handleGitlabWebhook(req, res, deps);

    expect(deps.repositoryService.markWebhookVerified).toHaveBeenCalledWith('r1');
    expect(res.status).toHaveBeenCalledWith(202);
  });
});

