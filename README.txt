JC Handyman Platform V5 Supabase Sync

Before uploading, replace YOUR_SUPABASE_PUBLISHABLE_KEY in both index.html and app.html.

Also create this table in Supabase:
website_leads
- id int8 primary identity
- created_at timestamptz
- name text
- phone text
- email text
- address text
- service text
- message text
- status text

If saving fails, check Supabase Row Level Security policies.
