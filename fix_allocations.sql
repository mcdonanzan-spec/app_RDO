/**
 * Script para corrigir alocações financeiras existentes
 * 
 * O problema: Quando uma alocação foi feita para "01.04" com tipo "MT",
 * o budget_group_code foi salvo como "01.04" ao invés de "01.04.MT".
 * 
 * Este script corrige esse problema no banco de dados.
 */

-- 1. Visualizar alocações que precisam ser corrigidas
SELECT 
    fa.id,
    fa.budget_group_code AS codigo_atual,
    fa.cost_type AS tipo,
    CONCAT(fa.budget_group_code, '.', fa.cost_type) AS codigo_correto,
    fa.value,
    fe.document_number AS numero_nf
FROM financial_allocations fa
JOIN financial_entries fe ON fa.entry_id = fe.id
WHERE 
    fa.cost_type IN ('MT', 'ST', 'EQ')
    AND fa.budget_group_code NOT LIKE '%.' || fa.cost_type
ORDER BY fe.issue_date DESC;

-- 2. Atualizar alocações com código incorreto
-- ATENÇÃO: Execute este comando apenas se os dados acima estiverem corretos!
UPDATE financial_allocations
SET budget_group_code = CONCAT(budget_group_code, '.', cost_type)
WHERE 
    cost_type IN ('MT', 'ST', 'EQ')
    AND budget_group_code NOT LIKE '%.' || cost_type
    AND EXISTS (
        SELECT 1 FROM budget_items bi
        WHERE bi.code = CONCAT(budget_group_code, '.', cost_type)
    );

-- 3. Verificar resultado
SELECT 
    fa.id,
    fa.budget_group_code,
    fa.cost_type,
    fa.value,
    fe.document_number
FROM financial_allocations fa
JOIN financial_entries fe ON fa.entry_id = fe.id
ORDER BY fe.issue_date DESC
LIMIT 10;
