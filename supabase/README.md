## Supabase migration helpers

### Create schema
Run the SQL in [schema.sql](/Users/rms/Desktop/BelajarBah/SenangBah/supabase/schema.sql) inside Supabase SQL Editor.

### Export old SQLite data
From the project root:

```bash
node scripts/export-sqlite-to-csv.js
```

The CSV files will be written to:

`supabase/exports/`

### Import order
Import parent tables first:

1. `school_codes`
2. `teachers`
3. `users`
4. `register_examples`
5. `pilot_registrations`
6. `sessions`
7. `responses`
8. `weekly_checkpoints`
9. `chat_messages`
10. `vocab_sessions`
11. `vocab_responses`
12. `essay_uploads`
13. `grammar_sessions`
14. `grammar_responses`
15. `reading_sessions`
16. `reading_responses`
