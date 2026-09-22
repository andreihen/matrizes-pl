# Prompt interno — revisão 2.3

Atue como engenheiro de software sênior especializado em aplicações educacionais de álgebra linear.

Trabalhe sobre o Laboratório de Matrizes 2.2 sem recriar o projeto. Preserve Fraction/Rational, histórico estruturado, operações, Sarrus, inversa, JSON e a navegação ESTUDAR/RESOLVER.

Prioridades desta revisão:

1. Toda Expansão de Laplace feita no modo de estudo deve ser registrada no mesmo histórico/exportação JSON das operações, porém como evento de análise, sem quebrar undo/redo da matriz.
2. Laplace deve ser uma continuação da mesma expressão matemática: coeficiente do elemento, sinal do cofator e resultados dos menores precisam permanecer acumulados até o resultado final.
3. Se uma expansão tiver um único termo não nulo, avance automaticamente ao menor relevante. Ex.: `det(A)=2·det(M11)` deve terminar multiplicando o resultado de `M11` por 2.
4. O resultado final deve considerar as operações anteriores sobre o determinante. Se a matriz atual possui fator acumulado `f` em relação à original, usar `det(A original)=det(matriz atual)/f`. Isso inclui o sinal `(-1)^trocas` e escalas de linha.
5. Não permitir `Li ↔ Li` nem `Ci ↔ Ci`, tanto na interface quanto no motor matemático.
6. Simplificar Laplace: remover sequência “iniciar → configurar → expandir”. Exibir diretamente eixo, índice e uma única ação contextual; em 3×3 oferecer Sarrus imediatamente.
7. Registrar no histórico eventos estruturados `laplaceExpansion`, `sarrusResolution`, resultado final e matrizes envolvidas. Frações devem permanecer exatas no JSON.
8. Melhorar responsividade global. Nenhum viewport de 320, 360, 375, 390, 430, 768 ou 1280 px deve gerar overflow horizontal da página. Matrizes e expressões largas devem rolar dentro do próprio componente.
9. Criar testes para: trocas idênticas inválidas; Laplace com coeficiente 2; sinal após troca; eventos no JSON; responsividade e fluxo 4×4 → 3×3 → Sarrus → resultado final.
10. Só concluir após executar os testes e corrigir falhas encontradas.
