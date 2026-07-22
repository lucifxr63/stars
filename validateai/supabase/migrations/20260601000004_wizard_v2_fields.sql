-- Sprint A: Wizard v2 — nuevos campos sin romper validaciones existentes
-- Las filas históricas quedan con NULL temporalmente (retrocompatible).
-- hasTechnicalCofounder se eliminará en Sprint C, una vez que founder_fit
-- ya no lo referencie en sus prompts de IA.

ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS idea_problem     TEXT,
  ADD COLUMN IF NOT EXISTS team_composition VARCHAR(50)
    CHECK (team_composition IN ('solo_founder', 'founding_team', 'team_with_employees')),
  ADD COLUMN IF NOT EXISTS traction_status  VARCHAR(50)
    CHECK (traction_status IN ('idea_on_paper', 'mvp_in_development', 'mvp_launched_no_sales', 'first_paying_customers'));
