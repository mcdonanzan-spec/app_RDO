import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [message, setMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (mode === 'signup') {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: email.split('@')[0] // Default name
                        }
                    }
                });
                if (error) throw error;
                if (data.user && !data.session) {
                    setMessage("Verifique seu email para confirmar o cadastro.");
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-100 items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="p-8 bg-slate-900 text-white text-center">
                    <div className="w-16 h-16 bg-yellow-400 text-slate-900 rounded-xl mx-auto flex items-center justify-center font-black text-2xl shadow-lg shadow-yellow-400/20 mb-4">
                        BRZ
                    </div>
                    <h1 className="text-2xl font-bold">Torre de Controle</h1>
                    <p className="text-slate-400 text-sm mt-1">SGO Digital Twin</p>
                </div>

                <div className="p-8 flex-1">
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Email Corporativo</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all font-medium"
                                    placeholder="seu.nome@brz.com.br"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">
                                ⚠️ {error}
                            </div>
                        )}

                        {message && (
                            <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-lg border border-green-100">
                                ✅ {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold uppercase tracking-wide hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'signin' ? 'Entrar' : 'Cadastrar')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-500">
                            {mode === 'signin' ? 'Não tem conta?' : 'Já tem conta?'}
                            <button
                                onClick={() => {
                                    setMode(mode === 'signin' ? 'signup' : 'signin');
                                    setError(null);
                                    setMessage(null);
                                }}
                                className="ml-1 font-bold text-indigo-600 hover:text-indigo-800 underline"
                            >
                                {mode === 'signin' ? 'Solicitar Acesso' : 'Fazer Login'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
