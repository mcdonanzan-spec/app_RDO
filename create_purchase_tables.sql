-- Create table for TOTVS Items (Catalog)
CREATE TABLE IF NOT EXISTS project_item_catalog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for Purchase Requests
CREATE TABLE IF NOT EXISTS project_purchase_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL, -- "REQ-1234"
    description TEXT NOT NULL,
    requester TEXT,
    priority TEXT,
    status TEXT,
    date TIMESTAMP WITH TIME ZONE,
    items JSONB, -- Store items as JSON for flexibility
    history JSONB, -- Store history logs
    budget_group_code TEXT,
    totvs_order_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_request_per_project UNIQUE (project_id, request_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_catalog_project ON project_item_catalog(project_id);
CREATE INDEX IF NOT EXISTS idx_requests_project ON project_purchase_requests(project_id);

-- Add RLS Policies (Enable RLS first)
ALTER TABLE project_item_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_purchase_requests ENABLE ROW LEVEL SECURITY;

-- Allow access to all authenticated users for now (refine later if needed)
CREATE POLICY "Allow all access to authenticad users" ON project_item_catalog FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticad users" ON project_purchase_requests FOR ALL USING (auth.role() = 'authenticated');
