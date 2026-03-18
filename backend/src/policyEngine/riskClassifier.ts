import type { PolicyDecision, PolicyEvaluationDetails, PolicyMatchedRule, PolicyRiskLevel, PolicyTaskContext } from './types';

const RISK_ORDER: PolicyRiskLevel[] = ['low', 'medium', 'high', 'critical'];

const TARGET_PATTERNS: Array<{ label: string; pattern: RegExp; risk: PolicyRiskLevel; reason: string }> = [
  {
    label: 'package.json',
    pattern: /\bpackage\.json\b/gi,
    risk: 'high',
    reason: 'Dependency manifest changes may affect builds and installs.'
  },
  {
    label: 'package-lock.json',
    pattern: /\bpackage-lock\.json\b/gi,
    risk: 'high',
    reason: 'Lockfile changes can alter dependency resolution.'
  },
  {
    label: 'pnpm-lock.yaml',
    pattern: /\bpnpm-lock\.yaml\b/gi,
    risk: 'high',
    reason: 'Lockfile changes can alter dependency resolution.'
  },
  {
    label: 'yarn.lock',
    pattern: /\byarn\.lock\b/gi,
    risk: 'high',
    reason: 'Lockfile changes can alter dependency resolution.'
  },
  {
    label: 'docker/',
    pattern: /\bdocker(?:\/[\w./-]*)?\b/gi,
    risk: 'critical',
    reason: 'Infrastructure and container changes affect deployment/runtime behavior.'
  },
  {
    label: 'infra/',
    pattern: /\binfra(?:\/[\w./-]*)?\b/gi,
    risk: 'critical',
    reason: 'Infrastructure changes affect deployment/runtime behavior.'
  },
  {
    label: 'deployment/',
    pattern: /\bdeployment(?:\/[\w./-]*)?\b/gi,
    risk: 'critical',
    reason: 'Deployment changes affect production/runtime behavior.'
  }
];

const COMMAND_PATTERNS: Array<{ label: string; pattern: RegExp; risk: PolicyRiskLevel; reason: string }> = [
  {
    label: 'run_shell_command',
    pattern: /\brun[_ -]?shell[_ -]?command\b/gi,
    risk: 'high',
    reason: 'Shell command execution is requested.'
  },
  {
    label: 'bash',
    pattern: /\bbash\b|\bsh\b|\bzsh\b/gi,
    risk: 'high',
    reason: 'Shell command execution is requested.'
  },
  {
    label: 'docker',
    pattern: /\bdocker\b/gi,
    risk: 'critical',
    reason: 'Container/runtime commands are requested.'
  },
  {
    label: 'kubectl',
    pattern: /\bkubectl\b|\bhelm\b/gi,
    risk: 'critical',
    reason: 'Cluster/runtime commands are requested.'
  },
  {
    label: 'terraform',
    pattern: /\bterraform\b/gi,
    risk: 'critical',
    reason: 'Infrastructure provisioning commands are requested.'
  },
  {
    label: 'curl',
    pattern: /\bcurl\b|\bwget\b/gi,
    risk: 'medium',
    reason: 'External network fetch commands are requested.'
  },
  {
    label: 'git push',
    pattern: /\bgit\s+push\b/gi,
    risk: 'high',
    reason: 'Pushing repository changes is requested.'
  },
  {
    label: 'create pr',
    pattern: /\b(?:gh|glab)\s+(?:pr|mr)\s+create\b|\bcreate\s+(?:pr|mr|pull request|merge request)\b/gi,
    risk: 'high',
    reason: 'Publishing repository changes is requested.'
  }
];

const GENERIC_PATH_PATTERN = /\b(?:[\w.-]+\/)+[\w./-]+\b/g;

const raiseRisk = (current: PolicyRiskLevel, next: PolicyRiskLevel): PolicyRiskLevel =>
  RISK_ORDER.indexOf(next) > RISK_ORDER.indexOf(current) ? next : current;

const pushUnique = (items: string[], value: string): void => {
  const normalized = String(value ?? '').trim();
  if (!normalized || items.includes(normalized)) return;
  items.push(normalized);
};

const findPatternMatches = (
  text: string,
  patterns: Array<{ label: string; pattern: RegExp }>
): string[] => {
  const matches: string[] = [];
  for (const item of patterns) {
    const regex = new RegExp(item.pattern.source, item.pattern.flags);
    let hit: RegExpExecArray | null;
    while ((hit = regex.exec(text)) !== null) {
      pushUnique(matches, hit[0] || item.label);
    }
  }
  return matches;
};

export const extractSignalsFromText = (input: { title?: string; promptCustom?: string; payload?: unknown }): {
  targetFiles: string[];
  commands: string[];
} => {
  const rawPayload = input.payload && typeof input.payload === 'object' ? JSON.stringify(input.payload) : String(input.payload ?? '');
  const text = [input.title ?? '', input.promptCustom ?? '', rawPayload].filter(Boolean).join('\n');

  const targetFiles = findPatternMatches(text, TARGET_PATTERNS);
  const genericTargets = text.match(GENERIC_PATH_PATTERN) ?? [];
  for (const item of genericTargets) pushUnique(targetFiles, item);

  const commands = findPatternMatches(text, COMMAND_PATTERNS);
  return { targetFiles, commands };
};

export interface RiskClassification {
  riskLevel: PolicyRiskLevel;
  reasons: string[];
  warnings: string[];
}

export const classifyTaskRisk = (context: PolicyTaskContext): RiskClassification => {
  let riskLevel: PolicyRiskLevel = 'low';
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (context.sandbox === 'workspace-write') {
    riskLevel = raiseRisk(riskLevel, 'high');
    pushUnique(reasons, 'Workspace-write can modify repository files.');
  }

  if (context.networkAccess) {
    riskLevel = raiseRisk(riskLevel, 'medium');
    pushUnique(warnings, 'Network access is enabled for this task.');
  }

  for (const item of TARGET_PATTERNS) {
    if (!context.targetFiles.some((value) => new RegExp(item.pattern.source, item.pattern.flags).test(value))) continue;
    riskLevel = raiseRisk(riskLevel, item.risk);
    pushUnique(reasons, item.reason);
  }

  for (const item of COMMAND_PATTERNS) {
    if (!context.commands.some((value) => new RegExp(item.pattern.source, item.pattern.flags).test(value))) continue;
    riskLevel = raiseRisk(riskLevel, item.risk);
    pushUnique(reasons, item.reason);
  }

  if (context.taskSource === 'chat' && context.sandbox === 'workspace-write') {
    pushUnique(warnings, 'Manual chat tasks are using write access.');
  }

  if (context.provider === 'codex') {
    pushUnique(warnings, 'Codex sessions allow network access by default.');
  }

  if (context.sandbox === 'workspace-write' && context.networkAccess) {
    riskLevel = raiseRisk(riskLevel, 'critical');
    pushUnique(reasons, 'This task combines repository write access with network access.');
  }

  return {
    riskLevel,
    reasons,
    warnings
  };
};

export const buildPolicySummary = (params: {
  decision: PolicyDecision;
  riskLevel: PolicyRiskLevel;
  reasons: string[];
  matchedRules: PolicyMatchedRule[];
}): string => {
  const selectedRule = params.matchedRules[0];
  const firstReason = params.reasons[0];

  if (params.decision === 'deny') {
    return selectedRule ? `Denied by policy rule "${selectedRule.name}".` : `Denied by ${params.riskLevel}-risk policy.`;
  }
  if (params.decision === 'require_approval') {
    if (selectedRule) return `Approval required by policy rule "${selectedRule.name}".`;
    if (firstReason) return `Approval required: ${firstReason}`;
    return `Approval required for a ${params.riskLevel}-risk task.`;
  }
  if (params.decision === 'allow_with_warning') {
    if (selectedRule) return `Allowed with warning by policy rule "${selectedRule.name}".`;
    if (firstReason) return `Allowed with warning: ${firstReason}`;
    return `Allowed with warnings for a ${params.riskLevel}-risk task.`;
  }
  return 'Allowed by policy.';
};

export const buildPolicyEvaluationDetails = (params: {
  decision: PolicyDecision;
  context: PolicyTaskContext;
  reasons: string[];
  warnings: string[];
  matchedRules: PolicyMatchedRule[];
}): PolicyEvaluationDetails => ({
  taskSource: params.context.taskSource,
  provider: params.context.provider,
  sandbox: params.context.sandbox,
  networkAccess: params.context.networkAccess,
  targetFiles: [...params.context.targetFiles],
  commands: [...params.context.commands],
  reasons: [...params.reasons],
  warnings: [...params.warnings],
  matchedRules: [...params.matchedRules]
});
