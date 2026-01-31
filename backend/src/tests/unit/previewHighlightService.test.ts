import { PreviewHighlightService } from '../../modules/tasks/preview-highlight.service';

// Validate preview highlight command publishing via SSE. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
describe('PreviewHighlightService', () => {
  test('publishes highlight commands with a request id', () => {
    const publish = jest.fn();
    const getTopicSubscriberCount = jest.fn().mockReturnValue(2);
    const eventStream = { publish, getTopicSubscriberCount } as any;
    const service = new PreviewHighlightService(eventStream);

    const result = service.publishHighlight('group-1', 'frontend', { selector: '.btn' });

    expect(result.subscribers).toBe(2);
    expect(result.requestId).toBeTruthy();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'preview-highlight:group-1',
        event: 'preview.highlight'
      })
    );
  });
});
