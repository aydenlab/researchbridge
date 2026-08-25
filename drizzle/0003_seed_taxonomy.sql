-- Reference taxonomy required by student and researcher onboarding.
-- Without these rows the research-area step renders no options while still
-- demanding one, which leaves onboarding impossible to finish.
-- Idempotent: safe to re-run, and never touches user-entered rows.

INSERT INTO research_fields (name, slug) VALUES
  ('Neuroscience', 'neuroscience'),
  ('Oncology', 'oncology'),
  ('Cardiology', 'cardiology'),
  ('Genetics', 'genetics'),
  ('Epidemiology', 'epidemiology'),
  ('Public Health', 'public-health'),
  ('Immunology', 'immunology'),
  ('Bioinformatics', 'bioinformatics'),
  ('Health Policy', 'health-policy'),
  ('Rehabilitation Science', 'rehabilitation-science'),
  ('Psychology', 'psychology'),
  ('Microbiology', 'microbiology'),
  ('Nutrition', 'nutrition'),
  ('Kinesiology', 'kinesiology'),
  ('Global Health', 'global-health'),
  ('Clinical Trials', 'clinical-trials')
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
INSERT INTO skills (name, slug, category, approved) VALUES
  ('Python', 'python', 'Computing', true),
  ('R', 'r', 'Computing', true),
  ('MATLAB', 'matlab', 'Computing', true),
  ('SPSS', 'spss', 'Computing', true),
  ('SQL', 'sql', 'Computing', true),
  ('Machine learning', 'machine-learning', 'Computing', true),
  ('Bioinformatics', 'bioinformatics', 'Computing', true),
  ('Data analysis', 'data-analysis', 'Analysis', true),
  ('Statistics', 'statistics', 'Analysis', true),
  ('Data visualization', 'data-visualization', 'Analysis', true),
  ('Systematic reviews', 'systematic-reviews', 'Analysis', true),
  ('Literature reviews', 'literature-reviews', 'Analysis', true),
  ('Wet lab', 'wet-lab', 'Laboratory', true),
  ('Cell culture', 'cell-culture', 'Laboratory', true),
  ('Microscopy', 'microscopy', 'Laboratory', true),
  ('PCR', 'pcr', 'Laboratory', true),
  ('Western blot', 'western-blot', 'Laboratory', true),
  ('Flow cytometry', 'flow-cytometry', 'Laboratory', true),
  ('Immunohistochemistry', 'immunohistochemistry', 'Laboratory', true),
  ('Patient recruitment', 'patient-recruitment', 'Clinical', true),
  ('Chart review', 'chart-review', 'Clinical', true),
  ('REDCap', 'redcap', 'Clinical', true),
  ('Scientific writing', 'scientific-writing', 'Communication', true),
  ('Presentation', 'presentation', 'Communication', true),
  ('Qualitative coding', 'qualitative-coding', 'Analysis', true),
  ('Survey design', 'survey-design', 'Analysis', true),
  ('Neuroimaging analysis', 'neuroimaging-analysis', 'Analysis', true),
  ('Animal handling', 'animal-handling', 'Laboratory', true)
ON CONFLICT (slug) DO NOTHING;
