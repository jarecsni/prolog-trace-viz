% Factorial predicate
% factorial(N, Result) - computes N! = Result

factorial(0, 1).
factorial(N, R) :-
    N > 0,
    N1 is N - 1,
    factorial(N1, R1),
    R is N * R1.

% Example queries:
% factorial(5, X).
% factorial(3, X).
