// Keep provider-routing log messages consistent across route selection and failover attempts. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
import type { ProviderRoutingAttemptResult, ProviderRoutingResult } from './providerRouting.types';
import type { ProviderRoutingPlan } from './providerRouting.service';

export const buildProviderRoutingPlanLog = (plan: ProviderRoutingPlan): string =>
  `Provider routing plan: mode=${plan.routingConfig.mode} primary=${plan.primaryProvider}${plan.fallbackProvider ? ` fallback=${plan.fallbackProvider}` : ''} failover=${plan.failoverPolicy} selected=${plan.selectedProvider}. ${plan.selectionReason}`;

export const buildProviderRoutingAttemptStartLog = (
  attempt: Pick<ProviderRoutingAttemptResult, 'provider' | 'role'>,
  index: number,
  total: number
): string => `Provider routing attempt ${index}/${total}: executing ${attempt.provider} (${attempt.role}).`;

export const buildProviderRoutingAttemptFailureLog = (
  attempt: Pick<ProviderRoutingAttemptResult, 'provider' | 'role'>,
  error: string
): string => `Provider routing attempt failed: provider=${attempt.provider} role=${attempt.role} error=${error}`;

export const buildProviderRoutingCompletionLog = (result: ProviderRoutingResult): string =>
  `Provider routing completed: final=${result.finalProvider ?? result.selectedProvider}${result.failoverTriggered ? ' failover=true' : ' failover=false'}`;
