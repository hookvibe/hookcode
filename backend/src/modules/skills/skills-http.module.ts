import { Module } from '@nestjs/common';
import { SkillsModule } from './skills.module';
import { SkillsController } from './skills.controller';

@Module({
  // Expose skill registry endpoints for the console UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  imports: [SkillsModule],
  controllers: [SkillsController]
})
export class SkillsHttpModule {}
