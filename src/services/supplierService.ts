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

    static async saveSuppliers(projectId: string, suppliers: Supplier[], onProgress?: (current: number, total: number) => void): Promise<void> {
        if (!projectId) return;

        try {
            // Deduplicate by CNPJ before batching to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
            const uniqueSuppliers = new Map();
            suppliers.forEach(s => {
                const key = s.cnpj.replace(/[^\d]/g, ''); // Normalize CNPJ
                if (!uniqueSuppliers.has(key)) {
                    uniqueSuppliers.set(key, s);
                }
            });
            const cleanSuppliers = Array.from(uniqueSuppliers.values());

            // Batch processing to avoid payload limits
            const BATCH_SIZE = 100;
            const chunks = [];

            for (let i = 0; i < cleanSuppliers.length; i += BATCH_SIZE) {
                chunks.push(cleanSuppliers.slice(i, i + BATCH_SIZE));
            }

            console.log(`Saving ${cleanSuppliers.length} unique suppliers (from ${suppliers.length} total) in ${chunks.length} batches...`);

            if (onProgress) onProgress(0, chunks.length);

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
                    throw error;
                }

                if (onProgress) onProgress(i + 1, chunks.length);

                // Small delay to prevent rate limiting
                await new Promise(r => setTimeout(r, 50));
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
