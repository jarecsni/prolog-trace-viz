:- consult('examples/3_3_operators.pl').

debug_clauses :-
    current_predicate(t/2),
    clause(t(A,B), Body, Ref),
    clause_property(Ref, line_count(Line)),
    format('t(~w,~w) at line ~w, ref ~w~n', [A,B,Line,Ref]),
    fail.
debug_clauses.

:- debug_clauses.
:- halt.