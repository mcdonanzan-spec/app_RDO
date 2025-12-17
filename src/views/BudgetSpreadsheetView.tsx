import React from 'react';
import { Target } from 'lucide-react';
import { AppData } from '../../types';
import { SpreadsheetViewer } from '../components/SpreadsheetViewer';

interface BudgetSpreadsheetViewProps {
    appData: AppData;
}

export const BudgetSpreadsheetView: React.FC<BudgetSpreadsheetViewProps> = ({ appData }) => {
    return (
        <SpreadsheetViewer
            sheets={appData.budgetSheets || []}
            title="O CAMINHO: Orçamento (Meta)"
            subtitle="Orçamento Executivo - Visão Fiel da Planilha"
            icon={<Target size={24} />}
            colorTheme="amber"
        />
    );
};
