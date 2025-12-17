import React from 'react';
import { History } from 'lucide-react';
import { AppData } from '../../types';
import { SpreadsheetViewer } from '../components/SpreadsheetViewer';

interface RDOViewProps {
    appData: AppData;
}

export const RDOView: React.FC<RDOViewProps> = ({ appData }) => {
    return (
        <SpreadsheetViewer
            sheets={appData.rdoSheets || []}
            title="O PASSADO: RDO (Realizado)"
            subtitle="Relatório Diário de Obra - Visão Fiel da Planilha"
            icon={<History size={24} />}
            colorTheme="blue"
        />
    );
};
