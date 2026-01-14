---
description: Como implantar o aplicativo na Vercel conectando ao GitHub
---

# Implantando na Vercel (Nova Conta)

Este guia orienta como conectar sua nova conta da Vercel ao GitHub para colocar o sistema no ar.

## Pré-requisitos
1.  O código mais recente deve estar no GitHub (Eu já fiz o upload para você).
2.  Você precisa ter em mãos as chaves do Supabase (URL e KEY) que usamos no `.env`.

## Passo 1: Conectar Vercel ao GitHub
1.  Faça login na sua nova conta da **Vercel**.
2.  No painel principal (Dashboard), clique no botão **"Add New..."** -> **"Project"**.
3.  Na tela "Import Git Repository", você verá uma opção para conectar ao **GitHub**. Clique nela.
4.  O GitHub vai pedir permissão. Aceite/Autorize.
5.  Após conectar, você verá uma lista dos seus repositórios. Procure por `app-desenbolso-v01` (ou o nome do seu repositório).
6.  Clique no botão **Import** ao lado dele.

## Passo 2: Configurar o Projeto
Você verá uma tela de configuração "Configure Project".
1.  **Project Name**: Pode deixar o padrão ou mudar se quiser.
2.  **Framework Preset**: A Vercel deve detectar automaticamente como `Vite`. Se não, selecione `Vite`.
3.  **Root Directory**: Deixe `./`.

## Passo 3: Variáveis de Ambiente (CRÍTICO)
**IMPORTANTE**: O sistema NÃO funcionará sem isso.

1.  Nessa mesma tela, clique em **Environment Variables**.
2.  Você precisa adicionar as duas chaves que configuramos no seu computador:
    *   **Nome**: `VITE_SUPABASE_URL`
    *   **Valor**: `https://rxltrvbozoozqdvkmvlg.supabase.co`
    *   Clique em **Add**.
    *   **Nome**: `VITE_SUPABASE_ANON_KEY`
    *   **Valor**: (Copie a chave longa `eyJ...` que você me mandou e está no seu arquivo .env)
    *   Clique em **Add**.

## Passo 4: Deploy
1.  Clique no botão **Deploy**.
2.  Aguarde alguns minutos. A Vercel vai baixar o código, instalar, e construir o site.
3.  Quando terminar, aparecerá a mensagem "Congratulations!".
4.  Clique na imagem do site ou em "Visit" para abrir seu sistema online!

## Atualizações Futuras
Sempre que fizermos alterações aqui e eu disser "enviei para o GitHub", a Vercel vai detectar automaticamente e atualizar o site sozinha (Redeploy). Você não precisa fazer mais nada!
