import { ValidationPipe } from '@nestjs/common';
import { ChatExecuteRequestDto } from '../../modules/tasks/dto/chat-swagger.dto';

describe('ChatExecuteRequestDto', () => {
  test('preserves chat payload fields with ValidationPipe whitelist', async () => {
    // Verify chat DTO keeps payload fields under ValidationPipe whitelist. docs/en/developer/plans/2w8gp733clurvugsxkme/task_plan.md 2w8gp733clurvugsxkme
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = { repoId: 'r1', robotId: 'rb1', text: 'hello', taskGroupId: 'g1' };
    const result = await pipe.transform(payload, { type: 'body', metatype: ChatExecuteRequestDto });
    expect(result).toMatchObject(payload);
  });
});
