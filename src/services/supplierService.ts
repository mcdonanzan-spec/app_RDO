import { supabase } from './supabase';
import { Supplier } from '../../types';

export class SupplierService {

    static async getSuppliers(projectId: string): Promise<Supplier[]> {
        try {
            let allSuppliers: any[] = [];
            let from = 0;
            const step = 1000; // Supabase default limit
            let more = true;

            while (more) {
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('project_id', projectId)
                    .order('razao_social', { ascending: true })
                    .range(from, from + step - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allSuppliers = [...allSuppliers, ...data];
                    from += step;
                    // If we got less than requested, we are done
                    if (data.length < step) more = false;
                } else {
                    more = false;
                }
            }

            return allSuppliers.map(s => ({
                id: s.id,
                razaoSocial: s.razao_social,
                cnpj: s.cnpj
            }));
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            return [];
        }
    }

    static async saveSuppliers(projectId: string, suppliers: Supplier[], onProgress?: (current: number, total: number) => void): Promise<number> {
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
            return cleanSuppliers.length;
        } catch (error) {
            console.error('Error saving suppliers:', error);
            throw error;
        }
    }

    static async deleteAllSuppliers(projectId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('project_id', projectId);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting suppliers:', error);
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
