-- 1600 Budget-hog rule tightened (docs/suggestions.md): a dominant ad is only
-- flagged with no leads or CPL over $80. The "max leads" threshold is retired.
update public.rule_settings set params = params - 'budgetHogMaxLeads' where params ? 'budgetHogMaxLeads';
