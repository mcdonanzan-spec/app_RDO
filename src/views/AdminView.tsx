import React, { useState, useEffect } from 'react';
import { Users, Building, Shield, Plus, MoreHorizontal, Search, Trash2, Edit2, CheckCircle, XCircle, ChevronRight, Lock, Loader2 } from 'lucide-react';
import { ProjectService, Project } from '../services/projectService';
import { UserService, Profile } from '../services/userService';

interface AdminViewProps {
    onProjectCreated?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onProjectCreated }) => {
    const [activeTab, setActiveTab] = useState<'projects' | 'users' | 'roles'>('projects');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);

    // Form state
    const [newName, setNewName] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [newUnits, setNewUnits] = useState(0);

    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'projects') {
                const data = await ProjectService.getProjects();
                setProjects(data);
            } else if (activeTab === 'users') {
                const data = await UserService.getProfiles();
                setUsers(data);
            }
        } catch (error) {
            console.error("Failed to load admin data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await ProjectService.createProject({
                name: newName,
                location: newLocation,
                status: 'PLANNING',
                units: newUnits
            });
            setShowNewProjectModal(false);
            setNewName('');
            setNewLocation('');
            setNewUnits(0);
            await loadData();
            if (onProjectCreated) onProjectCreated();
        } catch (error) {
            console.error("Failed to create project", error);
            alert("Erro ao criar obra.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir esta obra? Todos os dados vinculados serão perdidos.")) return;
        setLoading(true);
        try {
            await ProjectService.deleteProject(id);
            await loadData();
            if (onProjectCreated) onProjectCreated();
        } catch (error) {
            console.error("Failed to delete project", error);
            alert("Erro ao excluir obra.");
        } finally {
            setLoading(false);
        }
    };

    const renderProjects = () => (
        <div className="space-y-6">
            {showNewProjectModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 uppercase tracking-tight">Nova Obra</h2>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Empreendimento</label>
                                <input
                                    required
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="Ex: Residencial Jardins"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Localização (Cidade, UF)</label>
                                <input
                                    required
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newLocation}
                                    onChange={e => setNewLocation(e.target.value)}
                                    placeholder="Ex: São Paulo, SP"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total de Unidades</label>
                                <input
                                    type="number"
                                    required
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newUnits}
                                    onChange={e => setNewUnits(parseInt(e.target.value))}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowNewProjectModal(false)}
                                    className="px-4 py-2 text-slate-500 font-bold uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold uppercase text-xs hover:bg-indigo-700 transition-colors shadow-lg flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : 'Criar Obra'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar obras..."
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowNewProjectModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold uppercase flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={16} /> Nova Obra
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-slate-800">
                {projects.map(project => (
                    <div key={project.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Building size={24} />
                            </div>
                            <button
                                onClick={() => handleDeleteProject(project.id)}
                                className="text-slate-300 hover:text-red-600 transition-colors p-2"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-1">{project.name}</h3>
                        <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            {project.location}
                        </p>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-medium uppercase">Status</span>
                                <span className={`px-2 py-0.5 rounded-full font-bold ${project.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                    project.status === 'PLANNING' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {project.status === 'ACTIVE' ? 'Em Andamento' : project.status === 'PLANNING' ? 'Planejamento' : 'Concluído'}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-medium uppercase">Unidades</span>
                                <span className="font-mono text-slate-700 font-bold">{project.units}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${project.progress}%` }}></div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                            <button className="text-sm text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                                Gerenciar Detalhes <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const handleUpdateRole = async (userId: string, newRole: 'ADMIN' | 'EDITOR' | 'VIEWER') => {
        try {
            await UserService.updateRole(userId, newRole);
            await loadData();
        } catch (error) {
            console.error("Failed to update role", error);
            alert("Erro ao atualizar perfil.");
        }
    };

    const renderUsers = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center text-slate-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar usuários..."
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                    />
                </div>
                {/* Invite User Button could go here */}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 text-left">Nome / Email</th>
                            <th className="p-4 text-left">Perfil</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-slate-800">{user.full_name || 'Usuário sem nome'}</div>
                                    <div className="text-slate-500 text-xs">{user.email}</div>
                                </td>
                                <td className="p-4">
                                    <select
                                        value={user.role}
                                        onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                                        className="text-xs font-bold px-2 py-1 rounded border bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="VIEWER">VIEWER</option>
                                        <option value="EDITOR">EDITOR</option>
                                        <option value="ADMIN">ADMIN</option>
                                    </select>
                                </td>
                                <td className="p-4 text-center">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                        <CheckCircle size={10} /> Ativo
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded transition-colors" title="Remover (Apenas Visual)">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 shadow-md z-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                            <Shield className="text-indigo-400" /> Painel Administrativo
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Gestão de Obras, Usuários e Permissões de Acesso</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-200 px-6">
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`py-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-all ${activeTab === 'projects' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Building size={16} /> Obras & Projetos
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`py-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-all ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Users size={16} /> Usuários & Equipes
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`py-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-all ${activeTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Shield size={16} /> Perfis de Acesso
                        </div>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'projects' && renderProjects()}
                {activeTab === 'users' && renderUsers()}
                {activeTab === 'roles' && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        <Lock size={48} className="mb-4 text-slate-300" />
                        <p className="text-lg font-bold">Configuração de Perfis em Breve</p>
                        <p className="text-sm">Implementação dependente da migração para Supabase</p>
                    </div>
                )}
            </div>
        </div>
    );
};
