import { Module } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { UsageAggregationService } from './usageAggregation.service';
import { QuotaEnforcerService } from './quotaEnforcer.service';

@Module({
  providers: [BudgetService, UsageAggregationService, QuotaEnforcerService],
  exports: [BudgetService, UsageAggregationService, QuotaEnforcerService]
})
export class CostGovernanceModule {}
