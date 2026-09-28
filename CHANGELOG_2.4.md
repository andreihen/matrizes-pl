# Laboratório de Matrizes 2.4

## Entrada orientada pelo tipo de estudo

A tela de entrada agora começa pela escolha entre:

- Determinante;
- Inversa;
- Sistema linear;
- Operações matriciais.

Os campos se adaptam ao contexto. Determinante e inversa pedem a ordem de uma matriz quadrada; sistema linear pede equações e incógnitas; operações matriciais passam a usar uma coleção dinâmica de matrizes A, B, C...

As matrizes de exemplo foram removidas da entrada.

## Expressões com várias matrizes

O modo de operações matriciais não está mais limitado a A e B. É possível adicionar matrizes dinamicamente e escrever expressões como:

- `A + B`
- `2A + 4B*C`
- `(A+B)*C`
- `1/2A + B`

O avaliador respeita precedência, multiplicação matricial e multiplicação por escalar. Frações continuam exatas.

### Prática passo a passo

No modo de prática, cada matriz intermediária é preenchida pelo estudante. A aplicação:

- compara racionalmente célula por célula;
- destaca acertos e erros;
- informa a primeira posição incorreta e o valor esperado;
- permite revelar uma etapa sem revelar obrigatoriamente as demais;
- mostra o resultado final após todas as etapas serem acertadas.

## Gerador reverso de sistemas lineares

O gerador permite definir uma solução como:

- `x = 1/2`
- `y = 1/5`
- `z = 2`

ou sortear esses valores. Em seguida ele gera uma matriz de coeficientes invertível e calcula exatamente `b = A·x`, criando um sistema linear com solução única garantida. O exercício gerado entra no mesmo fluxo de matriz aumentada e escalonamento do restante do laboratório.

## Validações

- trocas da mesma linha ou da mesma coluna são rejeitadas pelo motor matemático;
- a interface desabilita a mesma linha/coluna no segundo seletor de troca;
- matrizes e soluções trabalham com `Fraction` sem conversão para ponto flutuante.

## Responsividade

Fluxos principais verificados em 320, 360, 390, 430, 768 e 1280 px sem overflow horizontal da página.
