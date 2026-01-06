import { supabase } from './supabase';

export interface Project {
    id: string;
    name: string;
    location: string;
    status: 'ACTIVE' | 'PLANNING' | 'COMPLETED';
    units: number;
    progress: number;
}

export const ProjectService = {
    async getProjects(): Promise<Project[]> {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as Project[];
    },

    async createProject(project: Omit<Project, 'id' | 'progress'>): Promise<Project> {
        const { data, error } = await supabase
            .from('projects')
            .insert([project])
            .select()
            .single();

        if (error) throw error;
        return data as Project;
    },

    async updateProject(id: string, updates: Partial<Project>): Promise<void> {
        const { error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteProject(id: string): Promise<void> {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
