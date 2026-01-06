import { supabase } from './supabase';

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: 'ADMIN' | 'EDITOR' | 'VIEWER';
    avatar_url?: string;
}

export const UserService = {
    async getProfiles(): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name');

        if (error) throw error;
        return data as Profile[];
    },

    async updateRole(userId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER'): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', userId);

        if (error) throw error;
    }
};
