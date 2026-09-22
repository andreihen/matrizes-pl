# Auditoria da versão 2.2

## Problemas estruturais atacados

A versão 2.1 ainda separava Praticar, Determinante, Inversa e Resolver como áreas concorrentes. Isso duplicava estado, controles e lógica de renderização. A versão 2.2 reorganiza a experiência em dois eixos: `ESTUDAR / RESOLVER` e `Determinante / Inversa`.

O histórico anterior também armazenava principalmente rótulo + matriz. Agora cada passo é estruturado, contendo tipo da operação, `before`, `after`, fator e referências de linha/coluna.

## Validações realizadas

- Testes Node.js de Fraction, operações, JSON, determinante, inversa, Sarrus, Laplace e histórico.
- Serialização de matrizes mantém frações como strings exatas.
- `1/2` e `2/4` são tratados como o mesmo valor na detecção de mudanças.
- Paridade das trocas de linha/coluna foi verificada.
- Escala de linha entra corretamente no fator acumulado do determinante.
- Fluxo de interface validado em Chromium headless com HTML/scripts injetados localmente.
- Fluxo 4×4 → Laplace → 3×3 → Sarrus → retorno ao termo pai foi exercitado.
- Viewports 320, 360, 375, 390, 430 e 1280 px não apresentaram overflow horizontal da página.

## Decisão matemática importante

Troca de colunas permanece disponível no estudo de determinantes, mas é desabilitada na inversa por Gauss-Jordan `[A | I]`, pois uma permutação de colunas exige tratamento adicional para recuperar corretamente a inversa da matriz original.
