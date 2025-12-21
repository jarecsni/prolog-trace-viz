# Prolog Execution Trace: append([1,2], [3,4], X)

## Query

```
append([1,2], [3,4], X)
```

## Clause Definitions

| Line # | Clause |
|--------|--------|
| 4 | `append([], L, L)` |
| 5 | `append([H|T], L, [H|R]) :- append(T, L, R)` |

## Execution Timeline

┌─ Step 1: CALL append([1,2],[3,4],_1030)
│  
│  Pattern Match:
│    Goal: append([1,2],[3,4],_1030)
│    Head: append([H|T], L, [H|R])
│    ├─ H = 1
│    ├─ T = [2]
│    ├─ L = [3,4]
│  
│  Clause: append([H|T], L, [H|R]) :- append(T, L, R) [line 5]
│  Spawns subgoals:
│    [1.1] append(T, L, R)
└─

┌─ Step 2: CALL append([2],[3,4],_978)
│  ◀── Solving subgoal [1.1]
│  
│  Pattern Match:
│    Goal: append([2],[3,4],_978)
│    Head: append([H|T], L, [H|R])
│    ├─ H = 2
│    ├─ T = []
│    ├─ L = [3,4]
│  
│  Clause: append([H|T], L, [H|R]) :- append(T, L, R) [line 5]
│  Spawns subgoals:
│    [2.1] append(T, L, R)
└─

┌─ Step 3: CALL append([],[3,4],_938)
│  ◀── Solving subgoal [2.1]
│  
│  Pattern Match:
│    Goal: append([],[3,4],_938)
│    Head: append([], L, L)
│    ├─ L = [3,4]
│    ├─ L = _938
│  
│  Clause: append([], L, L) [line 4] (fact)
└─

┌─ Step 4: EXIT append([],[3,4],[3,4])
│  ◀── Completed subgoal [2.1]
│  Bindings:
│    _938 = [3,4]
│  Returns to: Step 3
└─

┌─ Step 5: EXIT append([2],[3,4],[2,3,4])
│  ◀── Completed subgoal [1.1]
│  Bindings:
│    _978 = [2,3,4]
│  Returns to: Step 2
└─

┌─ Step 6: EXIT append([1,2],[3,4],[1,2,3,4])
│  Bindings:
│    _1030 = [1,2,3,4]
│  Returns to: Step 1
└─


## Call Tree

```mermaid
graph TD

%% Nodes
A["① append([H|T], L, [H|R])<br/>clause 5<br/>⑥ EXIT: _1030=[1,2,3,4]"]
B["② append([H|T], L, [H|R])<br/>clause 5<br/>⑤ EXIT: _978=[2,3,4]"]
C["③ append([], L, L)<br/>clause 4<br/>④ EXIT: _938=[3,4]"]

%% Edges
A -->|"append(T, L, R)"| B
B -->|"append(T, L, R)"| C

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#c8e6c9,stroke:#388e3c
style C fill:#c8e6c9,stroke:#388e3c
```

## Final Answer

```
X = [1,2,3,4]
```

_Showing first solution only._