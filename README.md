# Laboratório de Matrizes 2.3

Aplicação web local para estudar matrizes passo a passo com frações exatas, operações elementares, determinantes, Expansão de Laplace, Regra de Sarrus e inversa por `[A | I]`.

## Executar

Não há backend ou dependências externas para o site.

1. Extraia a pasta.
2. Abra `index.html` no navegador.

Testes matemáticos/histórico:

```bash
node test.js
```

## Arquivos principais

- `index.html` — interface.
- `styles.css` — layout e responsividade.
- `math.js` — Fraction, operações matriciais, determinantes, Laplace, Sarrus e inversa.
- `history.js` — sessões, operações, eventos de análise, undo/redo e JSON.
- `ui.js` — renderização reutilizável de matrizes, frações e feedback visual.
- `app.js` — integração dos fluxos ESTUDAR/RESOLVER.
- `test.js` — testes matemáticos e do histórico.
- `CHANGELOG_2.3.md` — mudanças desta versão.
- `PROMPT_IMPLEMENTACAO_2.3.md` — especificação usada nesta revisão.

## Laplace no modo de estudo

O fluxo agora é contínuo. Escolha linha/coluna e aplique Laplace. A expressão principal permanece visível.

Exemplo:

```text
det(A) = 2 · det(M11)
```

Se `M11` for 3×3, ele pode ser resolvido por Sarrus. Se `det(M11)=5`, a conta retorna automaticamente para:

```text
det(A atual) = 2 · 5 = 10
```

Se antes houve operações que mudam o determinante, a aplicação fecha a conta usando:

```text
det(A original) = det(A atual) / fator acumulado
```

O fator inclui trocas de linhas/colunas e multiplicações de linha.

## Histórico

A linha do tempo reúne:

- matriz inicial;
- operações de linha/coluna;
- Expansões de Laplace;
- resoluções por Sarrus;
- resultado final do determinante.

Esses dados também aparecem ao copiar/exportar o JSON da sessão. Eventos de Laplace são registrados como análises para não interferirem no undo/redo das operações da matriz.

## Trocas

Trocar uma linha ou coluna com ela mesma é rejeitado na UI e na camada matemática.

## Frações

Cálculos continuam exatos. `1/2` permanece racional e não vira `0.5` internamente.

## Responsividade validada

A interface foi verificada em:

- 320 px
- 360 px
- 375 px
- 390 px
- 430 px
- 768 px
- 1280 px

A página não apresenta overflow horizontal nesses tamanhos; matrizes e expressões largas usam rolagem interna.
