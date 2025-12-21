# Prolog Execution Trace: t(0+1+1, B)

## Query

```
t(0+1+1, B)
```

## Clause Definitions

| Line # | Clause |
|--------|--------|
| 5 | `test1 :- Term = (jimmy plays football and squash), write('Pretty: '), write(Term), nl, write('Canonical: '), write_canonical(Term), nl` |
| 10 | `test2 :- Term = (susan plays tennis and basketball and volleyball), write('Pretty: '), write(Term), nl, write('Canonical: '), write_canonical(Term), nl` |
| 19 | `diana was the secretary of the department` |
| 20 | `test3 :- Term = (diana was the secretary of the department), write('Pretty: '), write(Term), nl, write('Canonical: '), write_canonical(Term), nl` |
| 26 | `t(0+1, 1+0)` |
| 27 | `t(X+0+1, X+1+0)` |
| 28 | `t(X+1+1, Z) :- t(X+1, X1), t(X1+1, Z)` |

## Execution Timeline

┌─ Step 1: CALL t(0+1+1,_924)
│  
│  Pattern Match:
│    Goal: t(0+1+1,_924)
│    Head: t(_578+1+1,_568)
│    ├─ _578+1+1 = 0+1+1
│    ├─ _568 = _924
│  
│  Clause: t(_578+1+1,_568) :- t(_578+1,_592),t(_592+1,_568) [line 32]
│  Spawns subgoals:
│    [1.1] t(_578+1,_592)
│    [1.2] t(_592+1,_568)
└─

┌─ Step 2: CALL t(0+1,_886)
│  
│  Pattern Match:
│    Goal: t(0+1,_886)
│    Head: t(0+1,1+0)
│  
│  Clause: t(0+1,1+0) [line 30] (fact)
└─

┌─ Step 3: EXIT t(0+1,1+0)
│  Bindings:
│    _886 = 1+0
│  Returns to: Step 2
└─

┌─ Step 4: CALL t(1+0+1,_760)
│  
│  Pattern Match:
│    Goal: t(1+0+1,_760)
│    Head: t(_720+0+1,_720+1+0)
│    ├─ _720+0+1 = 1+0+1
│    ├─ _720+1+0 = _760
│  
│  Clause: t(_720+0+1,_720+1+0) [line 31] (fact)
└─

┌─ Step 5: EXIT t(1+0+1,1+1+0)
│  Bindings:
│    _760 = 1+1+0
│  Returns to: Step 4
└─

┌─ Step 6: EXIT t(0+1+1,1+1+0)
│  Bindings:
│    _924 = 1+1+0
│  Returns to: Step 1
└─


## Call Tree

```mermaid
graph TD

%% Nodes
A["① t(0+1+1,_924)<br/>⑥ EXIT: _924=1+1+0"]
B["② t(0+1,_886)<br/>③ EXIT: _886=1+0"]
C["④ t(1+0+1,_760)<br/>⑤ EXIT: _760=1+1+0"]

%% Edges
A -->|"subgoal 1"| B
A -->|"subgoal 2"| C

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#c8e6c9,stroke:#388e3c
style C fill:#c8e6c9,stroke:#388e3c
```

## Final Answer

```
B = 1+1+0
```

_Showing first solution only._