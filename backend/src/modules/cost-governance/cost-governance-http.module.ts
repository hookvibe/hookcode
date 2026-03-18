import { Module } from '@nestjs/common';
import { CostGovernanceModule } from '../../costGovernance/costGovernance.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { BudgetsController } from './budgets.controller';
import { CostGovernanceController } from './cost-governance.controller';

@Module({
  imports: [CostGovernanceModule, RepositoriesModule],
  controllers: [CostGovernanceController, BudgetsController]
})
export class CostGovernanceHttpModule {}
