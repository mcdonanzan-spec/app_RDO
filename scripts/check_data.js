const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("--- CHECAGEM DE DADOS NO SUPABASE ---");

    // 1. Get Projects
    const { data: projects, error: pError } = await supabase.from('projects').select('id, name');
    if (pError) {
        console.error("Erro ao buscar projetos:", pError);
        return;
    }

    if (!projects || projects.length === 0) {
        console.log("Nenhum projeto encontrado.");
        return;
    }

    for (const project of projects) {
        console.log(`\nProjeto: ${project.name} (ID: ${project.id})`);

        // 2. Get Budget Items grouped by cost_center
        const { data: items, error: iError } = await supabase
            .from('budget_items')
            .select('cost_center, code, description, total_value')
            .eq('project_id', project.id);

        if (iError) {
            console.error(`  Erro ao buscar itens de orçamento:`, iError);
            continue;
        }

        if (!items || items.length === 0) {
            console.log("  ⚠️ Nenhum item de orçamento encontrado para este projeto.");
            continue;
        }

        const summary = {};
        items.forEach(item => {
            const cc = item.cost_center || 'SEM_ABA (CONSOLIDADO?)';
            if (!summary[cc]) summary[cc] = { count: 0, total: 0, samples: [] };
            summary[cc].count++;
            summary[cc].total += (item.total_value || 0);
            if (summary[cc].samples.length < 3) {
                summary[cc].samples.push(`${item.code} - ${item.description}`);
            }
        });

        console.log(`  Total de itens: ${items.length}`);
        Object.entries(summary).forEach(([cc, data]) => {
            console.log(`  - Aba: [${cc}] -> ${data.count} itens | Total: R$ ${data.total.toLocaleString('pt-BR')}`);
            console.log(`    Amostras: ${data.samples.join(' | ')}`);
        });
    }
}

checkData();
