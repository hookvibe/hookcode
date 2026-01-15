jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

import { db } from '../../db';
import { UserService } from '../../modules/users/user.service';

const userService = new UserService();

describe('user model credentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getModelCredentials returns public shape and never includes apiKey', async () => {
    (db.user.findUnique as any).mockResolvedValueOnce({
      modelCredentials: {
        codex: {
          profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://api.example', apiKey: 'secret-1' }],
          defaultProfileId: 'c1'
        }
      }
    });

    const credentials = await userService.getModelCredentials('u1');

    expect(credentials).toEqual({
      codex: {
        profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://api.example/', hasApiKey: true }],
        defaultProfileId: 'c1'
      },
      claude_code: { profiles: [], defaultProfileId: undefined },
      gemini_cli: { profiles: [], defaultProfileId: undefined },
      gitlab: { profiles: [], defaultProfileId: undefined },
      github: { profiles: [], defaultProfileId: undefined }
    });
  });

  test('updateModelCredentials keeps existing apiKey when apiKey is undefined', async () => {
    (db.user.findUnique as any).mockResolvedValueOnce({
      modelCredentials: {
        codex: { profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://old.example', apiKey: 'secret-1' }] }
      }
    });
    (db.user.update as any).mockImplementation(async (params: any) => ({ modelCredentials: params.data.modelCredentials }));

    const next = await userService.updateModelCredentials('u1', {
      codex: { profiles: [{ id: 'c1', apiBaseUrl: 'https://new.example' }] }
    });

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          modelCredentials: expect.objectContaining({
            codex: {
              profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://new.example/', apiKey: 'secret-1' }],
              defaultProfileId: undefined
            }
          }),
          updatedAt: expect.any(Date)
        }),
        select: { modelCredentials: true }
      })
    );
    expect(next).toEqual({
      codex: {
        profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://new.example/', hasApiKey: true }],
        defaultProfileId: undefined
      },
      claude_code: { profiles: [], defaultProfileId: undefined },
      gemini_cli: { profiles: [], defaultProfileId: undefined },
      gitlab: { profiles: [], defaultProfileId: undefined },
      github: { profiles: [], defaultProfileId: undefined }
    });
  });

  test('updateModelCredentials clears apiKey when apiKey is null', async () => {
    (db.user.findUnique as any).mockResolvedValueOnce({
      modelCredentials: {
        codex: { profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://old.example', apiKey: 'secret-1' }] }
      }
    });
    (db.user.update as any).mockImplementation(async (params: any) => ({ modelCredentials: params.data.modelCredentials }));

    const next = await userService.updateModelCredentials('u1', {
      codex: { profiles: [{ id: 'c1', apiKey: null }] }
    });

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelCredentials: expect.objectContaining({
            codex: { profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://old.example/', apiKey: undefined }] }
          })
        })
      })
    );
    expect(next).toEqual({
      codex: {
        profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://old.example/', hasApiKey: false }],
        defaultProfileId: undefined
      },
      claude_code: { profiles: [], defaultProfileId: undefined },
      gemini_cli: { profiles: [], defaultProfileId: undefined },
      gitlab: { profiles: [], defaultProfileId: undefined },
      github: { profiles: [], defaultProfileId: undefined }
    });
  });

  test('updateModelCredentials supports gitlab/github credential profiles and never returns token', async () => {
    (db.user.findUnique as any).mockResolvedValueOnce({
      modelCredentials: {
        codex: { profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://old.example', apiKey: 'secret-1' }] },
        gitlab: { profiles: [{ id: 'gl-1', remark: 'main', token: 'glpat-1', cloneUsername: 'oauth2' }] }
      }
    });
    (db.user.update as any).mockImplementation(async (params: any) => ({ modelCredentials: params.data.modelCredentials }));

    const next = await userService.updateModelCredentials('u1', {
      gitlab: { profiles: [{ id: 'gl-1', cloneUsername: 'oauth2' }] },
      github: { profiles: [{ id: 'gh-1', remark: 'org-a', token: 'ghp_1', cloneUsername: 'x-access-token' }] }
    });

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelCredentials: expect.objectContaining({
            gitlab: {
              profiles: [{ id: 'gl-1', remark: 'main', token: 'glpat-1', cloneUsername: 'oauth2' }],
              defaultProfileId: undefined
            },
            github: {
              profiles: [{ id: 'gh-1', remark: 'org-a', token: 'ghp_1', cloneUsername: 'x-access-token' }],
              defaultProfileId: undefined
            }
          })
        })
      })
    );

    expect(next).toEqual({
      codex: {
        profiles: [{ id: 'c1', remark: 'main', apiBaseUrl: 'https://old.example/', hasApiKey: true }],
        defaultProfileId: undefined
      },
      claude_code: { profiles: [], defaultProfileId: undefined },
      gemini_cli: { profiles: [], defaultProfileId: undefined },
      gitlab: {
        profiles: [{ id: 'gl-1', remark: 'main', hasToken: true, cloneUsername: 'oauth2' }],
        defaultProfileId: undefined
      },
      github: {
        profiles: [{ id: 'gh-1', remark: 'org-a', hasToken: true, cloneUsername: 'x-access-token' }],
        defaultProfileId: undefined
      }
    });
  });
});
