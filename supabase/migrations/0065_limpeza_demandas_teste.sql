-- 0065: Clean up remaining test demandas leaked by cargos-acesso-rls.test.ts.
-- Same regex as 0054 (catches DA, DB, DPai, DFilha + millisecond timestamp).
-- Also cleans up demandas created by test users (@example.invalid emails).
DELETE FROM public.demandas
WHERE titulo ~ '^D[A-Za-z]* 1[0-9]{11,}'
   OR criado_por IN (
     SELECT id FROM auth.users WHERE email LIKE '%@example.invalid'
   );
