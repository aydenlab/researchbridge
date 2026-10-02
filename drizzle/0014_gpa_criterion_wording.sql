-- GPA weighted on the posting form is now graded rather than only reported, so
-- the wording stored on existing criteria no longer describes what happens.
UPDATE "opportunity_criteria"
SET "description" = 'Weighted on the posting form. Grades on any scale are compared by letter-grade equivalent: stronger grades count for more, and nobody is filtered out on grades alone.'
WHERE "type" = 'academic_metric'
  AND "description" = 'Weighted on the posting form. No minimum was set, so this reports academic standing rather than filtering on it.';
