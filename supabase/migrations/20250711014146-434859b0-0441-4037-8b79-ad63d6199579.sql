-- Primeiro, vamos criar uma view para acessar informações básicas dos usuários
-- que pode ser usada pela aplicação de forma segura
CREATE OR REPLACE VIEW public.user_emails AS
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users;

-- Garantir que apenas usuários autenticados podem ver esta view
ALTER VIEW public.user_emails OWNER TO postgres;
GRANT SELECT ON public.user_emails TO authenticated;

-- Criar uma função para buscar usuário por email
CREATE OR REPLACE FUNCTION public.get_user_by_email(user_email text)
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, email, raw_user_meta_data->>'full_name' as full_name
  FROM auth.users
  WHERE auth.users.email = user_email;
$$;

-- Dar permissão para authenticated users usarem a função
GRANT EXECUTE ON FUNCTION public.get_user_by_email(text) TO authenticated;