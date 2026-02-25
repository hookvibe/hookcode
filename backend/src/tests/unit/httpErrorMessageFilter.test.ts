export {};

import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpErrorMessageFilter } from '../../modules/common/filters/http-error-message.filter';

const buildHost = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res })
  } as any;
  return { res, host };
};

describe('HttpErrorMessageFilter', () => {
  test('adds message fallback when payload has only code', () => {
    // Verify code-only HttpException payloads gain an English message fallback. docs/en/developer/plans/im5mpw0g5827wu95w4ki/task_plan.md im5mpw0g5827wu95w4ki
    const filter = new HttpErrorMessageFilter();
    const { res, host } = buildHost();
    const exception = new HttpException({ code: 'RULE_ROBOT_REQUIRED' }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RULE_ROBOT_REQUIRED',
        message: 'Error code: RULE_ROBOT_REQUIRED',
        error: 'Error code: RULE_ROBOT_REQUIRED'
      })
    );
  });

  test('uses error string as message when message is missing', () => {
    // Ensure error summaries are surfaced via message when explicit message is absent. docs/en/developer/plans/im5mpw0g5827wu95w4ki/task_plan.md im5mpw0g5827wu95w4ki
    const filter = new HttpErrorMessageFilter();
    const { res, host } = buildHost();
    const exception = new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Unauthorized',
        message: 'Unauthorized'
      })
    );
  });
});
