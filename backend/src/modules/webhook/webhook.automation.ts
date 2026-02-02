import type { AutomationEventMapping } from './webhook.types';

// Split webhook event mapping helpers into a focused module. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const mapGitlabAutomationEvent = (eventName?: string, payload?: any): AutomationEventMapping | null => {
  switch (eventName) {
    case 'Push Hook':
      return { eventType: 'commit', subType: 'created' };
    case 'Issue Hook':
      return { eventType: 'issue', subType: 'created' };
    case 'Merge Request Hook': {
      const action = payload?.object_attributes?.action;
      if (!action || action === 'open' || action === 'reopen' || action === 'create') {
        return { eventType: 'merge_request', subType: 'created' };
      }
      if (action === 'update') {
        return { eventType: 'merge_request', subType: 'updated' };
      }
      return null;
    }
    case 'Note Hook': {
      const noteableType = payload?.object_attributes?.noteable_type;
      if (noteableType === 'Issue') return { eventType: 'issue', subType: 'commented' };
      if (noteableType === 'MergeRequest') return { eventType: 'merge_request', subType: 'commented' };
      if (noteableType === 'Commit') return { eventType: 'commit', subType: 'commented' };
      return null;
    }
    default:
      return null;
  }
};

export const mapGithubAutomationEvent = (eventName?: string, payload?: any): AutomationEventMapping | null => {
  switch (eventName) {
    case 'push':
      return { eventType: 'commit', subType: 'created' };
    case 'issues': {
      const action = payload?.action;
      if (!action || action === 'opened' || action === 'reopened') {
        return { eventType: 'issue', subType: 'created' };
      }
      return null;
    }
    case 'issue_comment': {
      const action = payload?.action;
      if (action && action !== 'created') return null;
      const isPr = Boolean(payload?.issue?.pull_request);
      return { eventType: isPr ? 'merge_request' : 'issue', subType: 'commented' };
    }
    case 'pull_request': {
      const action = payload?.action;
      if (!action || action === 'opened' || action === 'reopened') {
        return { eventType: 'merge_request', subType: 'created' };
      }
      if (action === 'synchronize' || action === 'edited') {
        return { eventType: 'merge_request', subType: 'updated' };
      }
      return null;
    }
    case 'commit_comment': {
      const action = payload?.action;
      if (action && action !== 'created') return null;
      return { eventType: 'commit', subType: 'commented' };
    }
    default:
      return null;
  }
};

export const extractSubType = (payload: any): string =>
  typeof payload?.__subType === 'string' ? payload.__subType.trim() : '';
