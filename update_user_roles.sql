-- =====================================================
-- Migration: Update User Roles System
-- Descrição: Atualiza o sistema de roles para incluir
--            ADM, GERENTE, ENGENHEIRO, ALMOXARIFE, VIEWER
-- Data: 2026-01-13
-- =====================================================

-- ===========================================
-- PASSO 1: REMOVER TODAS AS CONSTRAINTS
-- ===========================================

-- Remove constraint de profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Remove constraint de project_members
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;

-- ===========================================
-- PASSO 2: MIGRAR TODOS OS DADOS
-- ===========================================

-- 2.1 Migrar roles na tabela PROFILES
UPDATE profiles SET role = 'ADM' WHERE role = 'ADMIN';
UPDATE profiles SET role = 'ENGENHEIRO' WHERE role = 'EDITOR';
UPDATE profiles SET role = 'GERENTE' WHERE role = 'MANAGER';

-- 2.2 Migrar roles na tabela PROJECT_MEMBERS
UPDATE project_members SET role = 'GERENTE' WHERE role IN ('ADMIN', 'MANAGER');
UPDATE project_members SET role = 'ENGENHEIRO' WHERE role = 'EDITOR';

-- ===========================================
-- PASSO 3: CRIAR NOVAS CONSTRAINTS
-- ===========================================

-- 3.1 Criar constraint para PROFILES (inclui ADM)
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('ADM', 'GERENTE', 'ENGENHEIRO', 'ALMOXARIFE', 'VIEWER'));

-- 3.2 Criar constraint para PROJECT_MEMBERS (sem ADM)
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check 
  CHECK (role IN ('GERENTE', 'ENGENHEIRO', 'ALMOXARIFE', 'VIEWER'));

-- ===========================================
-- PASSO 4: VERIFICAÇÃO FINAL
-- ===========================================

-- Mostrar distribuição de roles em PROFILES
SELECT 
    'profiles' as tabela,
    role,
    COUNT(*) as quantidade
FROM profiles
GROUP BY role
ORDER BY role;

-- Mostrar distribuição de roles em PROJECT_MEMBERS
SELECT 
    'project_members' as tabela,
    role,
    COUNT(*) as quantidade
FROM project_members
GROUP BY role
ORDER BY role;

-- =====================================================
-- FIM DA MIGRATION - Todos os roles atualizados!
-- =====================================================
