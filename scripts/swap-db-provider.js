#!/usr/bin/env node
/**
 * Swap Prisma database provider between "postgresql" and "sqlite".
 * Usage: node scripts/swap-db-provider.js sqlite
 *        node scripts/swap-db-provider.js postgresql
 */
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const target = process.argv[2];
if (!target || !['postgresql', 'sqlite'].includes(target)) {
  console.error('Usage: node swap-db-provider.js <postgresql|sqlite>');
  process.exit(1);
}

const schemaPath = join(__dirname, '..', 'server', 'prisma', 'schema.prisma');
let schema = readFileSync(schemaPath, 'utf-8');

schema = schema.replace(
  /provider\s*=\s*"(postgresql|sqlite)"/,
  `provider = "${target}"`
);

writeFileSync(schemaPath, schema);
console.log(`Prisma provider set to "${target}"`);
