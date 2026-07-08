# Migrations

Schema del database versionato. La prima migration (profiles, schedule_events,
deadlines, deadline_templates, exams, study_plans, briefings, push_tokens + RLS)
è definita in `docs/guida-tecnica-build.md`, FASE 3, e verrà creata dopo il setup
del progetto Supabase (`supabase init` + `supabase db push`).

**Regola**: ogni tabella con `user_id` ha Row Level Security — un utente vede solo i suoi dati.
