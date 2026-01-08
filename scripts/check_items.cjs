const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jqcwovtgwttstyganmhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxY3dvdnRnd3R0c3R5Z2FubWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MzU2MjgsImV4cCI6MjA4MzMxMTYyOH0.pWvyJq4IbK5aB5REI_H2jKYIit5fnGeFCMNexx9ZFKU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBudgetItems() {
    console.log("--- BUSCANDO ITENS NA TABELA budget_items ---");

    // We try to see if we can read ANYTHING without being authenticated 
    // Usually anon can't see unless we have a public policy.
    // Let's try to find projects first to get IDs.

    const { data: projects } = await supabase.from('projects').select('id, name');

    if (!projects || projects.length === 0) {
        console.log("AVISO: Nenhum projeto visível via API Anon. RLS está funcionando.");
        console.log("Vou tentar buscar na tabela budget_items DIRETAMENTE sem filtro de projeto (caso alguma política permita)");
    } else {
        console.log("Projetos visíveis:", projects.length);
    }

    const { data: allItems, error } = await supabase.from('budget_items').select('*').limit(10);

    if (error) {
        console.log("Acesso à tabela budget_items negado via API Anon (RLS).");
    } else if (allItems.length === 0) {
        console.log("A tabela budget_items retornou 0 registros para este usuário.");
    } else {
        console.log(`SUCESSO! Encontrados ${allItems.length} itens (amostra).`);
        allItems.forEach(i => console.log(` - [${i.code}] ${i.description} | CC: ${i.cost_center}`));
    }
}

checkBudgetItems();
