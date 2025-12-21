% POC: Custom tracer using prolog_trace_interception/4
% This captures detailed execution information including actual unifications

:- dynamic trace_event/1.

% Hook into the tracer
user:prolog_trace_interception(Port, Frame, _Choice, continue) :-
    catch(capture_trace_event(Port, Frame), _, true).

% Capture trace events with detailed information
capture_trace_event(Port, Frame) :-
    prolog_frame_attribute(Frame, goal, Goal),
    prolog_frame_attribute(Frame, level, Level),
    
    % Get predicate info
    (   prolog_frame_attribute(Frame, predicate_indicator, PredInd)
    ->  true
    ;   PredInd = unknown
    ),
    
    % Get clause info if available
    (   prolog_frame_attribute(Frame, clause, ClauseRef)
    ->  clause_property(ClauseRef, line_count(Line)),
        clause(Head, Body, ClauseRef),
        ClauseInfo = clause(Head, Body, Line)
    ;   ClauseInfo = no_clause
    ),
    
    % Extract arguments if it's a compound goal
    (   compound(Goal),
        Goal =.. [Functor|Args],
        length(Args, Arity)
    ->  extract_frame_arguments(Frame, Arity, ArgValues),
        GoalInfo = goal(Functor, Args, ArgValues)
    ;   GoalInfo = goal(Goal, [], [])
    ),
    
    % Record the event
    assertz(trace_event(event(Port, Level, PredInd, GoalInfo, ClauseInfo))),
    
    % Print for debugging
    format('~w [L~w] ~w~n', [Port, Level, Goal]),
    (   Port = exit,
        ArgValues \= []
    ->  format('  Arguments: ~w~n', [ArgValues])
    ;   true
    ).

% Extract actual argument values from the frame
extract_frame_arguments(_, 0, []) :- !.
extract_frame_arguments(Frame, N, [Val|Rest]) :-
    N > 0,
    (   prolog_frame_attribute(Frame, argument(N), Val)
    ->  true
    ;   Val = '?'
    ),
    N1 is N - 1,
    extract_frame_arguments(Frame, N1, Rest).

% Clear trace events
clear_trace :-
    retractall(trace_event(_)).

% Show all captured events
show_trace :-
    trace_event(Event),
    format('~q.~n', [Event]),
    fail.
show_trace.

% Export trace to JSON-like format
export_trace_json(File) :-
    open(File, write, Stream),
    format(Stream, '[~n', []),
    findall(Event, trace_event(Event), Events),
    write_events_json(Stream, Events),
    format(Stream, '~n]~n', []),
    close(Stream).

write_events_json(_, []).
write_events_json(Stream, [Event]) :-
    format(Stream, '  ~q', [Event]).
write_events_json(Stream, [Event|Rest]) :-
    Rest \= [],
    format(Stream, '  ~q,~n', [Event]),
    write_events_json(Stream, Rest).

% Test predicates
t(0+1, 1+0).
t(X+0+1, X+1+0).
t(X+1+1, Z) :-
    t(X+1, X1),
    t(X1+1, Z).

% Run a test
test_trace :-
    clear_trace,
    trace,
    t(0+1+1, A),
    notrace,
    format('~n=== TRACE CAPTURED ===~n~n', []),
    show_trace,
    format('~n=== FINAL ANSWER ===~n', []),
    format('A = ~w~n', [A]).
