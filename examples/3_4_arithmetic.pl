
% -------------------------------------------------------------------------- %
% Greates common divisor
% -------------------------------------------------------------------------- %
% Rule #1: If X = Y, D is equal to D
gcd(X, X, X).

% Rule #2: If X < Y, then D is equal to the GCD of X and Y - X
gcd(X, Y, D) :- 
    X < Y,
    Y1 is Y - X,
    gcd(X, Y1, D).

% Rule #3: If Y < X, then swap and evaluate Rule #2
gcd(X, Y, D) :- 
    Y < X,
    gcd(Y, X, D).

% -------------------------------------------------------------------------- %
% Length of a list
% -------------------------------------------------------------------------- %
llength([], 0).
llength([_|T], N) :-
    llength(T, N1),
    N is N1 + 1.
