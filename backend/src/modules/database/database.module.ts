import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { db, pool } from '../../db';

@Global()
@Module({
  providers: [
    { provide: PrismaClient, useValue: db },
    { provide: Pool, useValue: pool }
  ],
  exports: [PrismaClient, Pool]
})
export class DatabaseModule {}

