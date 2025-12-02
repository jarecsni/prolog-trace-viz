% Classic append predicate
% append(List1, List2, Result) - concatenates List1 and List2 into Result

append([], L, L).
append([H|T], L, [H|R]) :- append(T, L, R).

% Example queries:
% append([1,2], [3,4], X).
% append(X, Y, [1,2,3]).
