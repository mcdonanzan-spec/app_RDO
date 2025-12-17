import React from 'react';

interface BuildingModelProps {
    numTowers: number;
    numFloors: number;
    aptsPerFloor: number;
    // Map de status: chave = "T{torre}-F{andar}-A{apto}", valor = status
    // Ex: "T1-F5-A2" -> "concluido"
    statusMap?: Record<string, 'concluido' | 'em_andamento' | 'atrasado' | 'nao_iniciado'>;
}

export const BuildingModel: React.FC<BuildingModelProps> = ({
    numTowers = 1,
    numFloors = 10,
    aptsPerFloor = 4,
    statusMap = {}
}) => {

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'concluido': return 'bg-green-500 border-green-600';
            case 'em_andamento': return 'bg-yellow-400 border-yellow-500';
            case 'atrasado': return 'bg-red-500 border-red-600';
            default: return 'bg-slate-200 border-slate-300'; // nao_iniciado
        }
    };

    return (
        <div className="flex flex-wrap gap-8 justify-center p-4 bg-slate-100 rounded-xl overflow-x-auto">
            {Array.from({ length: numTowers }).map((_, tIdx) => (
                <div key={tIdx} className="flex flex-col items-center">
                    <h4 className="font-bold text-slate-700 mb-2">Torre {tIdx + 1}</h4>
                    <div className="flex flex-col-reverse gap-1 bg-white p-2 rounded shadow-sm border border-slate-200">
                        {Array.from({ length: numFloors }).map((_, fIdx) => (
                            <div key={fIdx} className="flex gap-1">
                                <div className="w-6 text-[10px] text-slate-400 flex items-center justify-end pr-1">
                                    {fIdx + 1}º
                                </div>
                                {Array.from({ length: aptsPerFloor }).map((_, aIdx) => {
                                    const key = `T${tIdx + 1}-F${fIdx + 1}-A${aIdx + 1}`;
                                    const status = statusMap[key] || 'nao_iniciado';
                                    return (
                                        <div
                                            key={aIdx}
                                            title={`Apto ${aIdx + 1} - ${status}`}
                                            className={`w-6 h-4 rounded-sm border ${getStatusColor(status)} transition-colors hover:opacity-80 cursor-pointer`}
                                        ></div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <div className="w-full h-2 bg-slate-300 mt-1 rounded-full"></div>
                </div>
            ))}

            <div className="w-full flex justify-center gap-4 mt-4 text-xs text-slate-600">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Concluído</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> Em Andamento</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Atrasado</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-200 rounded-sm"></div> A Executar</div>
            </div>
        </div>
    );
};
