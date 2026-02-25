import { Module } from '@nestjs/common';
import { SkillsService } from './skills.service';

@Module({
  // Provide skills registry services for prompt injection and UI APIs. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  providers: [SkillsService],
  exports: [SkillsService]
})
export class SkillsModule {}
