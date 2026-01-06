import { supabase } from './supabase';
import { FinancialEntry } from '../../types';

export const FinancialService = {
    async getEntries(projectId: string): Promise<FinancialEntry[]> {
        const { data: entries, error } = await supabase
            .from('financial_entries')
            .select(`
                *,
                allocations:financial_allocations(*),
                installments:financial_installments(*)
            `)
            .eq('project_id', projectId);

        if (error) throw error;

        // Map Supabase snake_case to app camelCase
        return entries.map(e => ({
            id: e.id,
            documentNumber: e.document_number,
            supplier: e.supplier,
            description: e.description,
            issueDate: e.issue_date,
            totalValue: Number(e.total_value),
            status: e.status,
            allocations: e.allocations.map((a: any) => ({
                id: a.id,
                budgetGroupCode: a.budget_group_code,
                costType: a.cost_type,
                value: Number(a.value),
                description: a.description
            })),
            installments: e.installments.map((i: any) => ({
                id: i.id,
                number: i.number,
                dueDate: i.due_date,
                value: Number(i.value),
                status: i.status
            }))
        }));
    },

    async createEntry(entry: FinancialEntry, projectId: string, userId: string): Promise<FinancialEntry> {
        // 1. Insert Header
        const { data: header, error: headerError } = await supabase
            .from('financial_entries')
            .insert([{
                id: entry.id, // Use existing ID if provided, or let Supabase gen? App usually provides UUID.
                project_id: projectId,
                supplier: entry.supplier,
                document_number: entry.documentNumber,
                description: entry.description,
                issue_date: entry.issueDate,
                total_value: entry.totalValue,
                status: entry.status,
                created_by: userId
            }])
            .select()
            .single();

        if (headerError) throw headerError;

        // 2. Insert Allocations
        if (entry.allocations?.length > 0) {
            const allocsParams = entry.allocations.map(a => ({
                entry_id: header.id,
                budget_group_code: a.budgetGroupCode,
                cost_type: a.costType,
                value: a.value,
                description: a.description
            }));
            const { error: allocError } = await supabase.from('financial_allocations').insert(allocsParams);
            if (allocError) throw allocError;
        }

        // 3. Insert Installments
        if (entry.installments?.length > 0) {
            const instParams = entry.installments.map(i => ({
                entry_id: header.id,
                number: i.number,
                due_date: i.dueDate,
                value: i.value,
                status: i.status
            }));
            const { error: instError } = await supabase.from('financial_installments').insert(instParams);
            if (instError) throw instError;
        }

        return entry; // Return original for optimistic UI, or re-fetch
    }
};
