# Mi Español — Claude Co-Pilot Guide

## Supabase Access
- Project ID: jrjriwnnjpykijlgrbba
- Project URL: https://jrjriwnnjpykijlgrbba.supabase.co
- Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyanJpd25qanB5a2lqbGdyYmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzEyMzYsImV4cCI6MjA5OTU0NzIzNn0.md5t3d1S6bRqEt4TntH04iX3DAhQBuOTXARF-_IEpeg
- Use the Supabase MCP tool to query and write data directly

## Project Structure
- Each module is one file: `js/modules/<name>.js`
- Adding a new module: create the JS file, add a route in `js/router.js`, add a nav item in `js/nav.js`
- Schema: `supabase/migrations/001_initial_schema.sql`
- Spec: `docs/superpowers/specs/2026-07-13-spanish-learning-design.md`
- Plan 1: `docs/superpowers/plans/2026-07-13-foundation-and-vocab.md`

## Common Tasks
- Add vocab cards: INSERT into `vocab_cards` table
- Add grammar exercises: INSERT into `grammar_exercises` table
- Analyze vocab retention: query `vocab_cards` where `review_count > 0`, group by tag
- Log what you did: INSERT into `claude_log`

## Current Level
Landry: intermediate-mid (B1). Goal: B2/C1 by June 2028.
