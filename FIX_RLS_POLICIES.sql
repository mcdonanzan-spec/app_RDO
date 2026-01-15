-- ==========================================
-- FIX_RLS_POLICIES.sql
-- Corrige as políticas de RLS que estavam usando nomes de perfis incorretos
-- (ADMIN/EDITOR em vez de ADM/GERENTE/ENGENHEIRO)
-- ==========================================

-- 1. Políticas da tabela financial_entries
DROP POLICY IF EXISTS "Editors can insert entries" ON public.financial_entries;
CREATE POLICY "Editors can insert entries" ON public.financial_entries 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO')
    )
);

-- 2. Políticas da tabela financial_allocations
DROP POLICY IF EXISTS "Editors can insert allocations" ON public.financial_allocations;
CREATE POLICY "Editors can insert allocations" ON public.financial_allocations 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO')
    )
);

-- 3. Políticas da tabela financial_installments
DROP POLICY IF EXISTS "Editors can insert installments" ON public.financial_installments;
CREATE POLICY "Editors can insert installments" ON public.financial_installments 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO')
    )
);

-- 4. Garantir que as tabelas de dados core permitam acesso a esses perfis
-- (Muitas já estão como 'authenticated', mas vamos reforçar se necessário)

-- 5. Corrigir permissão de suppliers para ser mais específica (opcional, mas recomendado)
DROP POLICY IF EXISTS "Editors can insert suppliers" ON public.suppliers;
CREATE POLICY "Editors can insert suppliers" ON public.suppliers 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO')
    )
);
