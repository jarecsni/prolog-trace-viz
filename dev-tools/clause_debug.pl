% Simple test file to understand SWI-Prolog clause numbering
:- op(300, xfx, plays).

test1 :- write('test1').
diana was the secretary.
test2 :- write('test2').

t(0+1, 1+0).
t(X+0+1, X+1+0).
t(X+1+1, Z) :- t(X+1, X1), t(X1+1, Z).

% Debug predicate to show clause info
show_clauses :-
    forall(
        clause(t(A,B), Body, Ref),
        (
            clause_property(Ref, line_count(Line)),
            format('Clause ref ~w: t(~w,~w) at line ~w~n', [Ref, A, B, Line])
        )
    ).

:- show_clauses.