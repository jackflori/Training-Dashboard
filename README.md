# Training Dashboard

**[View it live →](https://training-dashboard-one-sigma.vercel.app/)**

A personal distance-running dashboard I built for my own cross country/track training:
plan the week, drop in GPX files from a watch, and see the season's shape against
the plan.

Platform-agnostic by design, reading GPX exports from Strava/Garmin Connect with no API keys or OAuth to maintain.

## How it's built

- **Next.js 14** (App Router) · React 18 · TypeScript (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS** with semantic color tokens and dark mode
- **PostgreSQL** via Prisma, hosted on Neon; deployed on Vercel
- **fast-xml-parser** for GPX; the distance, pace, and elevation math is hand-rolled
- **Zod** for request validation

## Note on AI Usage

This project was built with heavy AI assistance. My primary contributions were scoping, design decisions, and code review.

[`CLAUDE.md`](./CLAUDE.md) & [`DECISIONS.md`](./DECISIONS.md) are records of that process, reversals
included.
