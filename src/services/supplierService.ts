import { supabase } from './supabase';
import { Supplier } from '../../types';

export class SupplierService {

    static async getSuppliers(projectId: string): Promise<Supplier[]> {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('project_id', projectId)
                .order('razao_social', { ascending: true });

            if (error) throw error;

            return (data || []).map(s => ({
                id: s.id,
                razaoSocial: s.razao_social,
                cnpj: s.cnpj
            }));
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            return [];
        }
    }

    static async saveSuppliers(projectId: string, suppliers: Supplier[]): Promise<void> {
        if (!projectId) return;

        try {
            // Since we want to sync the full list and handle deletions/additions,
            // the simplest robust strategy for this use case is sync-diff or replace.
            // Given the list size might be large, replace might be heavy but safe for consistency.
            // However, RLS policies might prevent mass deletion if not careful.
            // Better strategy: Upsert all.
            // But we also need to handle deletions (if user removed a supplier).
            // For now, let's stick to UpsertING new/modified ones.
            // Ideally, we shouldn't actally delete suppliers if they are used in NFs.
            // So we will just UPSERT based on CNPJ+ProjectID.

            // Note: The UI currently sends the FULL list every time.
            // To avoid deleting historical data that might be linked, we will only UPSERT.
            // If the user "deleted" a supplier from the list, it won't be deleted from DB here
            // unless we explicitely handle deletion. 
            // For this specific requirement "save locallly -> save supabase", let's start with Upsert.

            // Batch processing to avoid payload limits (e.g., 500 records per batch)
            const BATCH_SIZE = 500;
            const chunks = [];

            for (let i = 0; i < suppliers.length; i += BATCH_SIZE) {
                chunks.push(suppliers.slice(i, i + BATCH_SIZE));
            }

            console.log(`Saving ${suppliers.length} suppliers in ${chunks.length} batches...`);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const { error } = await supabase
                    .from('suppliers')
                    .upsert(
                        chunk.map(s => ({
                            project_id: projectId,
                            razao_social: s.razaoSocial,
                            cnpj: s.cnpj
                        })),
                        { onConflict: 'project_id, cnpj' }
                    );

                if (error) {
                    console.error(`Error saving batch ${i + 1}/${chunks.length}:`, error);
                    // Continue with other batches, but throw error at end?
                    // Better to fail fast or try best effort? 
                    // Let's throw to indicate failure.
                    throw error;
                }

                // Optional: small delay to not overwhelm DB
                // await new Promise(r => setTimeout(r, 100));
            }

            console.log('All supplier batches saved successfully.');
        } catch (error) {
            console.error('Error saving suppliers:', error);
            throw error;
        }
    }

    static async addSupplier(projectId: string, supplier: Omit<Supplier, 'id'>): Promise<string> {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .insert({
                    project_id: projectId,
                    razao_social: supplier.razaoSocial,
                    cnpj: supplier.cnpj
                })
                .select('id')
                .single();

            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error('Error adding supplier:', error);
            throw error;
        }
    }
}
