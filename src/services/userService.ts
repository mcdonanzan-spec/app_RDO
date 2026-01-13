import { supabase } from './supabase';

export type UserRole = 'ADM' | 'GERENTE' | 'ENGENHEIRO' | 'ALMOXARIFE' | 'VIEWER';

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
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

    async getProfile(userId: string): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        return data as Profile;
    },

    async updateRole(userId: string, role: UserRole): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', userId);

        if (error) throw error;
    }
};
