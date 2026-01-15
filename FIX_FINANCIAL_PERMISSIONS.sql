-- FIX FINANCIAL PERMISSIONS FOR UPDATE AND DELETE
-- This script ensures that ADM, GERENTE and ENGENHEIRO can update and delete financial entries.

-- 1. FINANCIAL ENTRIES
DROP POLICY IF EXISTS "Editors can update entries" ON financial_entries;
CREATE POLICY "Editors can update entries" ON financial_entries 
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO'))
);

DROP POLICY IF EXISTS "Editors can delete entries" ON financial_entries;
CREATE POLICY "Editors can delete entries" ON financial_entries 
FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO'))
);

-- 2. FINANCIAL ALLOCATIONS (Used by updateEntry to clear and re-insert)
DROP POLICY IF EXISTS "Editors can manage allocations" ON financial_allocations;
CREATE POLICY "Editors can manage allocations" ON financial_allocations 
FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO'))
);

-- 3. FINANCIAL INSTALLMENTS (Used by updateEntry to clear and re-insert)
DROP POLICY IF EXISTS "Editors can manage installments" ON financial_installments;
CREATE POLICY "Editors can manage installments" ON financial_installments 
FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADM', 'GERENTE', 'ENGENHEIRO'))
);

-- Ensure RLS is enabled
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_installments ENABLE ROW LEVEL SECURITY;
