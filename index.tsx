import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle } from 'lucide-react';

import { AppData } from './types';
import { Sidebar } from './src/components/Sidebar';

// Consolidated Views
import { VisualManagementView } from './src/views/VisualManagementView';
import { PurchaseFlowView } from './src/views/PurchaseFlowView';
import { BudgetControlView } from './src/views/BudgetControlView';
import { IntelligenceView } from './src/views/IntelligenceView';
import { AnalyticalCashFlowView } from './src/views/AnalyticalCashFlowView';
import { DisbursementForecastView } from './src/views/DisbursementForecastView';
import { AIStrategyView } from './src/views/AIStrategyView';
import { SystemBlueprintView } from './src/views/SystemBlueprintView';

import { ApiService } from './src/services/api';
import { initializeVisualManagementDefaults } from './src/services/db';

// --- APP ---
const App = () => {
  const [activeView, setActiveView] = useState('purchase_flow'); // Default to Purchase Flow
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [appData, setAppData] = useState<AppData>({
    budget: [],
    masterPlanSheets: [],
    rhPremises: [],
    contractorData: { contracts: [] },
    supplyChainData: { orders: [] },
    purchaseRequests: [],
    budgetGroups: [],
    isLoaded: false,
    rdoData: [],
    projectionData: [],
    rdoSheets: [],
    budgetSheets: [],
    financialEntries: []
  });

  useEffect(() => {
    const loadData = async () => {
      // Initialize defaults first (only runs if DB empty)
      await initializeVisualManagementDefaults();

      const data = await ApiService.getAppData();
      if (data) {
        setAppData(data);
      }
    };
    loadData();
  }, []);

  const handleDataLoaded = async (data: Partial<AppData>) => {
    setAppData(prev => {
      const newData = { ...prev, ...data };
      // Trigger background save (fire and forget for UI responsiveness, or await if critical)
      ApiService.saveAppData(newData).catch(err => console.error("Auto-save failed", err));
      return newData;
    });
  };

  const renderView = () => {
    switch (activeView) {
      case 'purchase_flow': return <PurchaseFlowView appData={appData} onUpdate={handleDataLoaded} />;
      case 'budget_control': return <BudgetControlView appData={appData} onUpdate={handleDataLoaded} />;
      case 'visual_management': return <VisualManagementView appData={appData} />;
      case 'intelligence': return <IntelligenceView appData={appData} />;
      case 'strategy_bi': return <AIStrategyView appData={appData} />;
      case 'analytical_cash_flow': return <AnalyticalCashFlowView appData={appData} />;
      case 'disbursement_forecast': return <DisbursementForecastView appData={appData} onUpdate={handleDataLoaded} />;
      case 'system_summary': return <SystemBlueprintView />;

      // Fallback
      default: return <PurchaseFlowView appData={appData} onUpdate={handleDataLoaded} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-30">
          <div className="font-bold text-lg">Torre de Controle</div>
          <button onClick={() => setIsMobileOpen(true)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <main className="flex-1 overflow-auto relative z-0">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-900 p-8">
          <AlertTriangle size={64} className="mb-4 text-red-600" />
          <h1 className="text-3xl font-bold mb-2">Algo deu errado (Crash)</h1>
          <p className="mb-8 text-lg">Ocorreu um erro inesperado na aplicação.</p>
          <div className="bg-white p-6 rounded shadow-lg max-w-2xl w-full overflow-auto border border-red-200">
            <code className="text-sm font-mono text-red-700 whitespace-pre-wrap">
              {this.state.error && this.state.error.toString()}
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg"
          >
            Recarregar Aplicação
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- RENDER ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}