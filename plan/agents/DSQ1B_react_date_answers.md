DSQ1B: React DateRange follows the owner's answers (design system 1.7.0)

Base: dsq1a-design-answers (needs the 1.7.0 bundle.css for `[data-marks="2"]`); rebase on main after DSQ1A merges. Repo: zvirb/songnodes. The React port changes only where an answer changes behaviour already built: the DateRange outcome button is always the filled primary (DR-044, Q11) and a day with two coded marks shows both codes stacked (DR-047, Q14). DateField inherits both through DateRange; its Q12/Q13 comments cite the DRs. Q18 (tight inset fails the check, DR-050): no text-inset check exists in SongNodes to switch from warn to fail; building one is a follow-up.

## Owned paths
- frontend/src/components/ds/DateRange.tsx
- frontend/src/components/ds/DateRange.test.tsx
- frontend/src/components/ds/DateField.tsx
- frontend/src/components/ds/DateField.test.tsx
- plan/agents/DSQ1B_react_date_answers.md
