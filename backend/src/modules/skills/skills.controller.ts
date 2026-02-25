import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Patch,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  ConflictException
} from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SkillsService, SkillArchiveError } from './skills.service';
import { ListSkillsResponseDto, UpdateSkillDto, UpdateSkillResponseDto, UploadSkillResponseDto } from './dto/skills-swagger.dto';

@AuthScopeGroup('system') // Protect skill registry APIs with system scope. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
@Controller('skills')
@ApiTags('Skills')
@ApiBearerAuth('bearerAuth')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({
    summary: 'List skills',
    description: 'List built-in and extra skills with prompt metadata.',
    operationId: 'skills_list'
  })
  @ApiOkResponse({ description: 'OK', type: ListSkillsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list() {
    try {
      // Return combined skill registry metadata for the console UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      return await this.skillsService.listSkills();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[skills] list failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch skills' });
    }
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update extra skill toggles',
    description: 'Enable/disable extra skills or their prompt text injection flag.',
    operationId: 'skills_patch'
  })
  @ApiOkResponse({ description: 'OK', type: UpdateSkillResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async patch(@Param('id') id: string, @Body() body: UpdateSkillDto) {
    const enabled = typeof body?.enabled === 'boolean' ? body.enabled : undefined;
    const promptEnabled = typeof body?.promptEnabled === 'boolean' ? body.promptEnabled : undefined;
    // Normalize tag updates for extra skills. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const tags = Array.isArray(body?.tags) ? body.tags : undefined;
    if (enabled === undefined && promptEnabled === undefined && tags === undefined) {
      throw new BadRequestException({ error: 'enabled, promptEnabled, or tags is required' });
    }

    try {
      // Apply extra skill toggle updates for the console switch UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      const skill = await this.skillsService.updateExtraSkill(id, { enabled, promptEnabled, tags });
      if (!skill) throw new BadRequestException({ error: 'No updates provided' });
      return { skill };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException({ error: 'Skill not found' });
      }
      if (err instanceof HttpException) throw err;
      console.error('[skills] patch failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update skill' });
    }
  }

  @Post('upload')
  @ApiOperation({
    summary: 'Upload extra skill bundle',
    description: 'Upload a zip/tar skill bundle and register it as an extra skill.',
    operationId: 'skills_upload'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' }
      },
      required: ['file']
    }
  })
  @ApiOkResponse({ description: 'OK', type: UploadSkillResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }
    })
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ error: 'Archive file is required' });
    }
    try {
      // Register uploaded skill bundles as extra skills for the registry. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      const skill = await this.skillsService.createExtraSkillFromArchive({
        filename: file.originalname,
        buffer: file.buffer
      });
      return { skill };
    } catch (err) {
      if (err instanceof SkillArchiveError) {
        if (err.code === 'conflict') {
          throw new ConflictException({ error: err.message });
        }
        throw new BadRequestException({ error: err.message });
      }
      if (err instanceof HttpException) throw err;
      console.error('[skills] upload failed', err);
      throw new InternalServerErrorException({ error: 'Failed to upload skill' });
    }
  }
}
