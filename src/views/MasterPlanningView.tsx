import React from 'react';
import { BrainCircuit } from 'lucide-react';
import { AppData } from '../../types';
import { SpreadsheetViewer } from '../components/SpreadsheetViewer';

interface MasterPlanningViewProps {
    appData: AppData;
}

export const MasterPlanningView: React.FC<MasterPlanningViewProps> = ({ appData }) => {
    return (
        <SpreadsheetViewer
            sheets={appData.masterPlanSheets || []}
            title="O FUTURO: Planejamento Mestre"
            subtitle="Cronograma Físico-Financeiro - Visão Fiel da Planilha 01"
            icon={<BrainCircuit size={24} />}
            colorTheme="purple"
        />
    );
};
