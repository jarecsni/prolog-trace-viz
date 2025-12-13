:- consult('tracer.pl').
:- consult('clause_debug.pl').

test_trace :-
    install_tracer,
    t(0+1+1, B),
    export_trace_json('debug_trace.json'),
    remove_tracer.

:- test_trace.
:- halt.