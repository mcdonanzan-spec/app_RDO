const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jqcwovtgwttstyganmhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxY3dvdnRnd3R0c3R5Z2FubWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MzU2MjgsImV4cCI6MjA4MzMxMTYyOH0.pWvyJq4IbK5aB5REI_H2jKYIit5fnGeFCMNexx9ZFKU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const { data: projects } = await supabase.from('projects').select('id, name');
    if (!projects || projects.length === 0) {
        console.log("NENHUM PROJETO VISÍVEL COM O ANON_KEY.");
        return;
    }

    console.log("PROJETOS VISÍVEIS:");
    for (const p of projects) {
        console.log(`- ${p.name} (${p.id})`);
        const { data: bItems } = await supabase.from('budget_items').select('id, cost_center').eq('project_id', p.id);
        if (bItems) {
            console.log(`  >> Itens de Orçamento: ${bItems.length}`);
            const stats = {};
            bItems.forEach(i => stats[i.cost_center || 'NULL'] = (stats[i.cost_center || 'NULL'] || 0) + 1);
            console.log(`  >> Distribuição:`, stats);
        } else {
            console.log(`  >> Não foi possível ler budget_items para este projeto.`);
        }
    }
}

checkUser();
