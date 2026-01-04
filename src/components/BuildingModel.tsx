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
        <div className="flex flex-col w-full">
            {/* Containers das Torres */}
            <div className="flex flex-nowrap gap-12 overflow-x-auto custom-scrollbar p-10 bg-slate-100 rounded-xl min-h-[420px] items-start justify-start">
                {Array.from({ length: numTowers }).map((_, tIdx) => (
                    <div key={tIdx} className="flex flex-col items-center flex-shrink-0">
                        <h4 className="font-bold text-slate-700 mb-3 bg-white px-4 py-1 rounded-full shadow-sm border border-slate-200 text-sm">
                            Torre {tIdx + 1}
                        </h4>
                        <div className="flex flex-col-reverse gap-1 bg-white p-3 rounded-lg shadow-md border border-slate-200">
                            {Array.from({ length: numFloors }).map((_, fIdx) => (
                                <div key={fIdx} className="flex gap-1.5">
                                    <div className="w-7 text-[10px] font-bold text-slate-400 flex items-center justify-end pr-1.5">
                                        {fIdx + 1}º
                                    </div>
                                    {Array.from({ length: aptsPerFloor }).map((_, aIdx) => {
                                        const key = `T${tIdx + 1}-F${fIdx + 1}-A${aIdx + 1}`;
                                        const status = statusMap[key] || 'nao_iniciado';
                                        return (
                                            <div
                                                key={aIdx}
                                                title={`Apto ${aIdx + 1} - ${status}`}
                                                className={`w-7 h-5 rounded-sm border ${getStatusColor(status)} transition-all hover:scale-110 hover:shadow-md cursor-help`}
                                            ></div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        <div className="w-full h-2.5 bg-slate-300 mt-2 rounded-full shadow-inner"></div>
                    </div>
                ))}
            </div>

            {/* Legenda na parte inferior */}
            <div className="flex flex-wrap justify-center gap-6 mt-6 px-4 py-3 bg-white border border-slate-100 rounded-lg shadow-sm w-fit mx-auto">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <div className="w-4 h-4 bg-green-500 rounded shadow-sm"></div> Concluído
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <div className="w-4 h-4 bg-yellow-400 rounded shadow-sm"></div> Em Andamento
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <div className="w-4 h-4 bg-red-500 rounded shadow-sm"></div> Atrasado
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <div className="w-4 h-4 bg-slate-200 rounded shadow-sm"></div> A Executar (Orçado)
                </div>
            </div>
        </div>
    );
};
