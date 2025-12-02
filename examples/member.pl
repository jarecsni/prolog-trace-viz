% Member predicate
% member(Element, List) - succeeds if Element is in List

member(X, [X|_]).
member(X, [_|T]) :- member(X, T).

% Example queries:
% member(2, [1,2,3]).
% member(X, [a,b,c]).
