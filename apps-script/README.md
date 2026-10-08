# Backend de correção por IA

O arquivo `Code.gs` recebe as respostas da atividade, corrige as questões discursivas pelo Gemini e registra uma linha por envio na planilha configurada.

## Configuração necessária

1. Criar ou abrir um projeto Apps Script vinculado à planilha `1KiD113MEk8rHFXY8XG1AoRKodWVYDPK5tSrDyHJ4WdY`.
2. Adicionar `Code.gs` e `appsscript.json` ao projeto.
3. Em **Configurações do projeto → Propriedades do script**, criar:
   - `GEMINI_API_KEY`: chave da API Gemini.
4. Implantar como **Aplicativo da Web**, executando como o proprietário e com acesso para qualquer pessoa que tenha o link.
5. Copiar a URL `/exec` gerada e substituir `__APPS_SCRIPT_WEB_APP_URL__` no `index.html`.
6. Autorizar os escopos do Sheets e de requisições externas quando o Apps Script solicitar.

A chave nunca deve ser colocada no HTML ou no repositório público. O documento fornecido continha somente o endpoint-modelo com `${apiKey}`, não uma chave funcional.
