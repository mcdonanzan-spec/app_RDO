# 🔄 MIGRATION PLAN: IndexedDB → Supabase

## ✅ COMPLETED
- [x] Visual Management (Gestão à Vista)
  - Table: `project_visual_management`
  - Service: `ApiService.getVisualManagementData()` / `saveAppData()`

## 🚧 PENDING MIGRATIONS

### 1. **Disbursement Forecast View** (Previsão de Desembolso)
**Current State:** Saves to `db.meta` (IndexedDB)
**Data Saved:**
- `disbursementForecast` - Monthly forecast values
- `disbursementForecastStartMonth` - Starting month
- `disbursementBudgetOverrides` - Manual budget overrides
- `disbursementDescOverrides` - Description overrides
- `disbursementForecastProjectionLength` - Projection period
- `disbursementInitialRealized` - Initial realized values

**Migration Plan:**
- Create table: `project_disbursement_forecast`
- Fields: `project_id`, `data` (jsonb), `updated_at`
- Update: Lines 140-181 in `DisbursementForecastView.tsx`

---

### 2. **Analytical Cash Flow View** (Fluxo de Caixa Analítico)
**Current State:** Saves to `db.meta` (IndexedDB)
**Data Saved:**
- `cashFlowCommitments` - Commitment values by budget code
- `cashFlowClosedMonth` - Closed month marker

**Migration Plan:**
- Create table: `project_cash_flow_data`
- Fields: `project_id`, `commitments` (jsonb), `closed_month` (text), `updated_at`
- Update: Lines 128-139 in `AnalyticalCashFlowView.tsx`

---

### 3. **AI Strategy View** (Estratégia & BI)
**Current State:** Saves to `db.meta` + `db.strategySnapshots` (IndexedDB)
**Data Saved:**
- `disbursementForecast` - (read-only from DisbursementForecastView)
- `strategyColors` - Custom colors for chart curves
- Strategy Snapshots - Saved S-curve states

**Migration Plan:**
- Create table: `project_strategy_snapshots`
- Fields: `id`, `project_id`, `date`, `description`, `data` (jsonb)
- Add: `strategy_colors` to `project_disbursement_forecast`
- Update: Lines 33-45 and 201 in `AIStrategyView.tsx`

---

### 4. **Intelligence View** (IA Generativa)
**Current State:** Saves to `db.savedAnalyses` (IndexedDB)
**Data Saved:**
- AI conversation history
- Generated KPIs and charts

**Migration Plan:**
- Create table: `project_ai_analyses`
- Fields: `id`, `project_id`, `date`, `query`, `response` (jsonb)
- Update: Line 115 in `IntelligenceView.tsx`

---

### 5. **AI Input Center View** (Central de Inputs AI)
**Current State:** Uses `ApiService.saveAppData()`
**Data Saved:**
- RH Premises
- Contracts
- Supply Chain data

**Migration Plan:**
- Already partially in Supabase via `financial_entries`
- Need to verify and complete migration
- Update: Lines 67, 85, 105 in `AIInputCenterView.tsx`

---

### 6. **Excel Migration View** (Migração de Excel)
**Current State:** Uses `ApiService.saveAppData()`
**Data Saved:**
- Uploaded Excel data temporarily

**Migration Plan:**
- Low priority (temporary data)
- Can keep local or migrate to Supabase storage

---

## 📋 IMPLEMENTATION ORDER

1. **HIGH PRIORITY:**
   - DisbursementForecastView (most complex, most used)
   - AnalyticalCashFlowView (critical financial data)
   
2. **MEDIUM PRIORITY:**
   - AIStrategyView (snapshots feature)
   - IntelligenceView (AI history)

3. **LOW PRIORITY:**
   - AIInputCenterView (verify current state)
   - ExcelMigrationView (temporary data)

---

## 🛠️ TECHNICAL APPROACH

### Step 1: Create Supabase Schema
Create SQL file with ALL new tables:
- `project_disbursement_forecast`
- `project_cash_flow_data`
- `project_strategy_snapshots`
- `project_ai_analyses`

### Step 2: Create Service Methods
Add to `ApiService.ts`:
- `getDisbursementForecast(projectId)`
- `saveDisbursementForecast(projectId, data)`
- `getCashFlowData(projectId)`
- `saveCashFlowData(projectId, data)`
- `getStrategySnapshots(projectId)`
- `saveStrategySnapshot(projectId, snapshot)`
- `getAIAnalyses(projectId)`
- `saveAIAnalysis(projectId, analysis)`

### Step 3: Update Each View
- Replace `db.meta.get()` → `ApiService.getData()`
- Replace `db.meta.put()` → `ApiService.saveData()`
- Add `appData.activeProjectId` checks
- Add error handling

### Step 4: Test & Deploy
- Test each view individually
- Verify data persistence
- Deploy to Vercel

---

## ⚠️ CRITICAL NOTES

1. **ALL saves must include `project_id`** - data is scoped per project
2. **Keep IndexedDB as fallback** for offline mode (read-only)
3. **Auto-save on change** - don't wait for manual save button
4. **Loading states** - show spinner while fetching from Supabase
