export {};

import fs from 'fs';
import path from 'path';

const backendRoot = path.resolve(__dirname, '../../..');

const resolveGeneratedPrismaClientIndex = (): string => {
  const prismaPackageJson = require.resolve('@prisma/client/package.json', { paths: [backendRoot] });
  return require.resolve('.prisma/client/index.js', { paths: [path.dirname(prismaPackageJson)] });
};

describe('Prisma client engine mode', () => {
  test('schema pins engineType client for Windows-safe generation', () => {
    // Keep Prisma generation on the JS engine path so backend pretest does not rewrite a locked Windows DLL. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    expect(schema).toMatch(/generator\s+client\s*\{[\s\S]*engineType\s*=\s*"client"/);
  });

  test('generated client reports engineType client', () => {
    // Assert the generated client matches the schema setting so Windows test runs stop depending on query_engine-windows.dll.node. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const generatedClientIndex = resolveGeneratedPrismaClientIndex();
    const generatedClient = fs.readFileSync(generatedClientIndex, 'utf8');

    expect(generatedClient).toMatch(/"engineType"\s*:\s*"client"/);
    expect(generatedClient).not.toMatch(/"engineType"\s*:\s*"library"/);
  });
});
