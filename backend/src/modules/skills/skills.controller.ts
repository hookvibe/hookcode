// Include NestJS Query decorator for skill list query params. docs/en/developer/plans/apiquery-fix-20260227/task_plan.md apiquery-fix-20260227
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
  Query,
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
  ApiQuery,
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
import { decodeNameCursor } from '../../utils/pagination';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import { isUuidLike } from '../../utils/uuid';

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
  // Document cursor pagination for skill registry lists. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  @ApiQuery({ name: 'source', required: false, description: 'Filter skill source (built_in or extra) for paginated lists.' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size for paginated skill lists.' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor for paginated skill lists.' })
  @ApiOkResponse({ description: 'OK', type: ListSkillsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Query('source') sourceRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined
  ) {
    try {
      const source = normalizeString(sourceRaw);
      const wantsPagination = Boolean(source || cursorRaw || limitRaw);
      if (!wantsPagination) {
        // Return combined skill registry metadata for the console UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
        return await this.skillsService.listSkills();
      }
      if (source !== 'built_in' && source !== 'extra') {
        throw new BadRequestException({ error: 'source is required for paginated skill lists' });
      }
      const limit = parsePositiveInt(limitRaw, 24);
      const cursor = decodeNameCursor(cursorRaw);
      if (cursorRaw && !cursor) {
        // Reject invalid cursors so skill pagination stays deterministic. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
        throw new BadRequestException({ error: 'Invalid cursor' });
      }
      if (source === 'extra' && cursor && !isUuidLike(cursor.id)) {
        // Guard extra-skill cursors to avoid invalid UUID lookups. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
        throw new BadRequestException({ error: 'Invalid cursor' });
      }

      if (source === 'built_in') {
        const page = await this.skillsService.listBuiltInSkillsPage({ limit, cursor: cursor ?? undefined });
        return {
          builtIn: page.skills,
          extra: [],
          ...(page.nextCursor ? { builtInNextCursor: page.nextCursor } : {})
        };
      }

      const page = await this.skillsService.listExtraSkillsPage({ limit, cursor: cursor ?? undefined });
      return {
        builtIn: [],
        extra: page.skills,
        ...(page.nextCursor ? { extraNextCursor: page.nextCursor } : {})
      };
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
