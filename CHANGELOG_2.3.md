# Laboratório de Matrizes 2.3

## Laplace integrado ao cálculo

- Expansões de Laplace agora entram no histórico e no JSON da sessão.
- O histórico possui uma linha do tempo única com operações de matriz e eventos de análise.
- O coeficiente e o sinal do cofator permanecem ligados ao menor durante toda a resolução.
- Se houver um único termo não nulo, o menor seguinte é aberto automaticamente.
- Ao resolver um menor 3×3 por Sarrus, o resultado retorna ao termo pai e é multiplicado pelo coeficiente acumulado.
- A tela mantém uma "Conta principal" visível durante a redução.

## Fechamento do determinante

O resultado calculado por Laplace/Sarrus corresponde à matriz atual. A versão 2.3 usa o fator acumulado das operações para recuperar o determinante da matriz inicial:

`det(A original) = det(matriz atual) / fator das operações`

Esse fator considera:

- troca de linhas: `×(-1)`;
- troca de colunas: `×(-1)`;
- multiplicação de linha por `k`: `×k`;
- soma de múltiplo de outra linha: não altera o determinante.

Assim, o campo "Sinal atual" não é apenas informativo: ele participa do fechamento da conta.

## Operações inválidas

- `L1 ↔ L1` é bloqueado.
- `C2 ↔ C2` é bloqueado.
- A interface desabilita a opção coincidente e o motor matemático também rejeita a operação.

## UX de Laplace

O fluxo antigo com vários passos foi substituído por um painel direto:

1. escolher Linha ou Coluna;
2. escolher o índice;
3. clicar em **Reduzir por Laplace**.

Quando o menor em foco é 3×3, o botão **Resolver 3×3 com Sarrus** aparece imediatamente.

## Responsividade

Foram tratados overflow de expressões, cards, matrizes, breadcrumbs e controles. Os testes de interface não encontraram overflow horizontal da página em 320, 360, 375, 390, 430, 768 e 1280 px.
