import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { SheetData } from '../../types';

interface SpreadsheetViewerProps {
    sheets: SheetData[];
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    colorTheme?: 'blue' | 'amber' | 'purple' | 'slate';
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
    sheets,
    title,
    subtitle,
    icon,
    colorTheme = 'slate'
}) => {
    const [activeTab, setActiveTab] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [manualHeaderRow, setManualHeaderRow] = useState<number | null>(null);
    const [isSelectingHeader, setIsSelectingHeader] = useState(false);

    const currentSheet = sheets && sheets.length > 0 ? sheets[activeTab] : null;

    const ROW_HEIGHT = 22;
    const OVERSCAN = 10;
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(800);

    useEffect(() => {
        setManualHeaderRow(null);
        const updateHeight = () => {
            if (scrollContainerRef.current) {
                setViewportHeight(scrollContainerRef.current.clientHeight);
            }
        };
        window.addEventListener('resize', updateHeight);
        setTimeout(updateHeight, 100);
        return () => window.removeEventListener('resize', updateHeight);
    }, [activeTab]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    const handleRowClick = (rowIndex: number) => {
        if (isSelectingHeader) {
            setManualHeaderRow(rowIndex);
            setIsSelectingHeader(false);
        }
    };

    const { visibleRowIndices, spanMap, stickyRowData } = useMemo(() => {
        if (!currentSheet) return { visibleRowIndices: [], spanMap: {}, stickyRowData: null };

        const indices = [];
        const hiddenRows = currentSheet.hiddenRows || [];
        for (let i = 0; i < currentSheet.data.length; i++) {
            if (!hiddenRows[i]) {
                indices.push(i);
            }
        }

        const map: Record<string, { rowSpan: number, colSpan: number, isGhost: boolean }> = {};
        if (currentSheet.merges) {
            currentSheet.merges.forEach(range => {
                let visibleColSpan = 0;
                for (let c = range.s.c; c <= range.e.c; c++) {
                    if (!currentSheet.hiddenCols?.[c]) visibleColSpan++;
                }

                if (visibleColSpan === 0) return;

                const startKey = `${range.s.r},${range.s.c}`;
                map[startKey] = {
                    rowSpan: range.e.r - range.s.r + 1,
                    colSpan: visibleColSpan,
                    isGhost: false
                };

                for (let r = range.s.r; r <= range.e.r; r++) {
                    for (let c = range.s.c; c <= range.e.c; c++) {
                        if (r === range.s.r && c === range.s.c) continue;
                        map[`${r},${c}`] = { rowSpan: 0, colSpan: 0, isGhost: true };
                    }
                }
            });
        }

        let stickyData = null;
        if (manualHeaderRow !== null && currentSheet.data[manualHeaderRow]) {
            stickyData = currentSheet.data[manualHeaderRow];
        }

        return { visibleRowIndices: indices, spanMap: map, stickyRowData: stickyData };
    }, [currentSheet, manualHeaderRow]);

    if (!currentSheet) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-white text-slate-400">
                <FileSpreadsheet size={64} className="mb-4 opacity-20 text-slate-300" />
                <p className="text-lg font-medium text-slate-600">Nenhuma planilha carregada.</p>
                <p className="text-sm">Vá em "Migração Excel" e carregue os arquivos.</p>
            </div>
        );
    }

    const totalVisibleRows = visibleRowIndices.length;
    const totalHeight = totalVisibleRows * ROW_HEIGHT;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(totalVisibleRows, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
    const renderRows = [];
    for (let i = startIndex; i < endIndex; i++) {
        renderRows.push(visibleRowIndices[i]);
    }

    // Theme colors
    const themeColors = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', hover: 'hover:bg-blue-100' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', hover: 'hover:bg-amber-100' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', hover: 'hover:bg-purple-100' },
        slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300', hover: 'hover:bg-slate-100' },
    }[colorTheme];

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    {icon && <div className={`p-2 rounded-lg ${themeColors.bg} ${themeColors.text}`}>{icon}</div>}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 leading-tight">{title}</h2>
                        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (manualHeaderRow !== null) {
                                setManualHeaderRow(null);
                            } else {
                                setIsSelectingHeader(!isSelectingHeader);
                            }
                        }}
                        className={`
                    flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold border transition-colors
                    ${isSelectingHeader
                                ? 'bg-blue-100 text-blue-700 border-blue-300 animate-pulse'
                                : manualHeaderRow !== null
                                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}
                `}
                    >
                        {manualHeaderRow !== null ? 'Desafixar Cabeçalho' : '📌 Fixar Cabeçalho'}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-1 px-2 pt-2 border-b border-slate-200 bg-slate-50 overflow-x-auto no-scrollbar">
                {sheets.map((sheet, idx) => (
                    <button
                        key={idx}
                        onClick={() => { setActiveTab(idx); setScrollTop(0); if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0; }}
                        className={`
            px-4 py-2 text-xs font-bold uppercase tracking-tight whitespace-nowrap transition-all rounded-t-md border-t border-x
            ${activeTab === idx
                                ? 'bg-white text-slate-800 border-slate-300 border-b-white translate-y-[1px] shadow-[0_-2px_5px_rgba(0,0,0,0.02)]'
                                : 'bg-slate-100 text-slate-400 border-transparent hover:bg-slate-200 hover:text-slate-600'}
            `}
                    >
                        {sheet.name}
                    </button>
                ))}
            </div>

            {manualHeaderRow !== null && stickyRowData && (
                <div className="border-b border-slate-300 shadow-sm bg-slate-50 overflow-hidden relative z-10" style={{ marginRight: '10px' }}>
                    <table
                        className="table-fixed border-collapse"
                        style={{
                            width: 'max-content',
                            minWidth: '100%',
                            transform: `translateX(-${scrollContainerRef.current?.scrollLeft || 0}px)`
                        }}
                    >
                        <colgroup>
                            {currentSheet.colWidths?.map((w, idx) => {
                                if (currentSheet.hiddenCols?.[idx]) return <col key={idx} style={{ width: '0px', visibility: 'collapse' }} />;
                                return <col key={idx} style={{ width: `${w}px` }} />;
                            })}
                        </colgroup>
                        <tbody>
                            <tr style={{ height: ROW_HEIGHT }}>
                                {stickyRowData.map((cellValue, colIndex) => {
                                    if (currentSheet.hiddenCols?.[colIndex]) return null;
                                    const displayValue = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
                                    return (
                                        <td key={colIndex} className="px-2 py-0 text-[11px] font-bold bg-slate-100 text-slate-800 border-r border-b border-[#d4d4d4] whitespace-nowrap overflow-hidden">
                                            {displayValue}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto bg-white relative custom-scrollbar"
                onScroll={handleScroll}
                style={{ cursor: isSelectingHeader ? 'crosshair' : 'default' }}
            >
                <div style={{ height: totalHeight, width: '1px', position: 'absolute', top: 0, left: 0, zIndex: -1 }}></div>

                <table
                    className="bg-white table-fixed border-collapse"
                    style={{
                        transform: `translateY(${startIndex * ROW_HEIGHT}px)`,
                        width: 'max-content',
                        minWidth: '100%'
                    }}
                >
                    <colgroup>
                        {currentSheet.colWidths?.map((w, idx) => {
                            if (currentSheet.hiddenCols?.[idx]) return <col key={idx} style={{ width: '0px', visibility: 'collapse' }} />;
                            return <col key={idx} style={{ width: `${w}px` }} />;
                        })}
                    </colgroup>

                    <tbody>
                        {renderRows.map((rowIndex) => {
                            const rowData = currentSheet.data[rowIndex] || [];
                            const isStickyPlaceholder = rowIndex === manualHeaderRow;

                            if (isStickyPlaceholder) {
                                return <tr key={rowIndex} style={{ height: ROW_HEIGHT, visibility: 'hidden' }}></tr>;
                            }

                            return (
                                <tr
                                    key={rowIndex}
                                    style={{ height: ROW_HEIGHT }}
                                    onClick={() => handleRowClick(rowIndex)}
                                    className={`
                    ${isSelectingHeader ? 'hover:bg-blue-50' : ''}
                `}
                                >
                                    {rowData.map((cellValue, colIndex) => {
                                        if (currentSheet.hiddenCols?.[colIndex]) return null;

                                        const cellKey = `${rowIndex},${colIndex}`;
                                        const spanInfo = spanMap[cellKey];

                                        if (spanInfo?.isGhost) return null;

                                        let displayValue = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';

                                        const isNumberLike = /^[R$]?\s*-?[\d.,]+%?$/.test(displayValue.trim()) && !displayValue.includes('-');
                                        const isHeader = rowIndex < 5 || (typeof cellValue === 'string' && (cellValue === cellValue.toUpperCase() && cellValue.length > 3));

                                        return (
                                            <td
                                                key={colIndex}
                                                colSpan={spanInfo?.colSpan || 1}
                                                rowSpan={spanInfo?.rowSpan || 1}
                                                className={`
                      px-2 py-0 text-[11px] font-sans border-r border-b border-[#d4d4d4] overflow-hidden whitespace-nowrap text-slate-700
                      ${isNumberLike ? 'text-right' : 'text-left'}
                      ${isHeader ? 'font-bold' : ''}
                      ${spanInfo ? 'bg-white z-10 align-middle text-center' : ''}
                    `}
                                                title={displayValue}
                                                style={{ fontFamily: 'Arial, sans-serif' }}
                                            >
                                                {displayValue}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="bg-white px-4 py-1 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between items-center shadow-md z-20">
                <span>
                    {isSelectingHeader ? 'MODO SELEÇÃO: Clique na linha que deseja fixar como cabeçalho.' : 'Visualização: Modo Relatório (Fidelidade Ativa)'}
                </span>
                <span>{totalVisibleRows} linhas renderizadas</span>
            </div>
        </div>
    );
};
