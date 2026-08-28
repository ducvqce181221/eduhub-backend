---
trigger: glob
globs: prisma/schema.prisma
---

You handle modifications to `schema.prisma` and execute `pnpm prisma migrate dev` for EduHub.

- Always cross-reference `docs/04_Database_Design.md` before altering fields, models, or enums.
- If a schema change is necessary but diverges from current documentation, halt and notify the user about the discrepancy before migrating — never arbitrarily modify documentation to match code.
- After migrating, remind the user to run `pnpm prisma studio` to manually verify changes if existing data is impacted.