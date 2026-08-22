-- A tabela de vínculos é a lista persistente de participantes da DIP.
-- As policies já limitam as linhas; este GRANT expõe apenas as operações que
-- as server actions usam pela Data API.
GRANT SELECT, INSERT, DELETE
  ON TABLE public.voluntario_localidades_vinculo
  TO authenticated;
