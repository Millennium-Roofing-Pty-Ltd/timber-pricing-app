# Recovery review (2026-11-11)

Preserves recovered node-postgres adapter and declares pg 8.13.1 / @types/pg 8.11.6 explicitly, using versions already present in the lockfile.

Cloud verification: npm ci --ignore-scripts succeeded; baseline and candidate npm run build passed; adapter import/configuration smoke check passed without connecting to a database; git diff --check passed.

npm run check fails at the same 14 existing TypeScript error locations on both baseline and candidate. These include chart types, nullable strings, import-stock schema mismatches and missing stockSupplierLinks import. No new type-error locations introduced by this change.

Not release-ready. No database migration, production deployment, or main merge performed. Resolve baseline type errors and perform real isolated-database and application checks before release.
