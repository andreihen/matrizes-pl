# Laboratório de Matrizes 2.2

Aplicação web local para estudar matrizes com operações manuais, frações exatas, histórico estruturado, determinantes e inversas.

## Como executar

Não há backend nem dependências externas para usar o site.

1. Extraia a pasta.
2. Abra `index.html` no navegador.

Para os testes matemáticos:

```bash
node test.js
```

## Estrutura

- `index.html` — estrutura principal da interface.
- `styles.css` — layout, responsividade e estados visuais.
- `math.js` — Fraction, operações, determinantes, Laplace, Sarrus e inversa.
- `history.js` — sessões, undo/redo, histórico estruturado e serialização JSON.
- `ui.js` — matrizes reutilizáveis, frações, copiar JSON, toast e highlights.
- `app.js` — estado, navegação e integração dos fluxos.
- `test.js` — testes matemáticos e de histórico.

## Navegação 2.2

A interface agora possui dois modos principais:

- **ESTUDAR** — o aluno realiza as operações.
- **RESOLVER** — o sistema apresenta uma resolução.

Dentro dos dois modos é possível escolher:

- **Determinante**
- **Inversa**

As sessões de estudo de determinante e inversa são mantidas separadamente.

## JSON

Toda matriz renderizada possui **Copiar JSON**. Inteiros são exportados como números e frações não inteiras como strings:

```json
[
  ["1/2", 2],
  ["-3/4", 1]
]
```

O histórico pode ser copiado ou exportado como um JSON de sessão contendo matriz inicial, matriz atual, passos, `before`, `after`, operação estruturada e metadados.

## Determinantes

No modo de estudo:

- operações de linha e troca de colunas;
- contador separado de trocas de linhas/colunas;
- fator de sinal `(-1)^trocas`;
- fator acumulado das operações que alteram o determinante;
- Expansão de Laplace navegável;
- termos de Laplace permanecem pendentes até seus menores serem resolvidos;
- menores 3×3 podem ser resolvidos por Sarrus;
- o resultado retorna ao termo pai automaticamente;
- linha/coluna com um único termo não nulo pode avançar automaticamente para o menor relevante;
- sugestão de linha/coluna com mais zeros.

No fechamento, a ferramenta relaciona o determinante da matriz transformada ao determinante da matriz inicial, incluindo trocas e escalas de linha.

## Operação manual

Antes da conferência, células matematicamente alteradas recebem destaque neutro. Por exemplo, `1/2` e `2/4` são considerados iguais e não são marcados como alteração.

Depois da conferência, somente alterações realizadas recebem estado de correto/incorreto.

## Inversa

O modo **ESTUDAR → Inversa** cria automaticamente `[A | I]`. Trocas de coluna ficam desabilitadas no Gauss-Jordan padrão. Ao atingir `[I | A⁻¹]`, é possível verificar `A × A⁻¹ = I`.

## Responsividade

Os fluxos principais foram validados sem overflow horizontal da página em:

- 320 px
- 360 px
- 375 px
- 390 px
- 430 px
- 1280 px

Matrizes largas mantêm rolagem dentro do próprio componente.
