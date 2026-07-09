JC Handyman CRM V18 Phase 1 Field Service

Install:
1. Extract ZIP.
2. Run MIGRATION_V18_PHASE_1.sql in Supabase SQL Editor.
3. Upload these root files to GitHub beside app.html:
   calendar.html
   field-checkin.html
   job-photos.html
   signature-capture.html
   estimate-generator.html
   invoice-generator.html
4. Commit changes.
5. Wait 1-2 minutes.
6. Open:
   https://jchandyman.github.io/jc-handyman-website/calendar.html

Test:
- Calendar saves appointment
- Field check-in saves
- Photo upload works
- Signature capture saves
- Estimate generator prints
- Invoice generator prints

Note:
Photo/signature uploads require your Supabase storage bucket named job-files to exist and have public access policies.
