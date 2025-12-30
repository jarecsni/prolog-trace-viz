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

┌─ Step 1: append([1,2],[3,4],_1396)
│  Clause: append([H|T], L, [H|R]) [line 5]
│  Unifications:
│    H = 1
│    T = [2]
│    L = [3,4]
│  Subgoals:
│    [1.1] append(T, L, R) → append([2], [3,4], R)
│  
│  ┌─ Step 2 [Goal 1.1]: append([2],[3,4],_1304)
│  │  Clause: append([H|T], L, [H|R]) [line 5]
│  │  Unifications:
│  │    H = 2
│  │    T = []
│  │    L = [3,4]
│  │  Subgoals:
│  │    [2.1] append(T, L, R) → append([], [3,4], R)
│  │  
│  │  ┌─ Step 3 [Goal 2.1]: append([],[3,4],_1224)
│  │  │  Fact: append([], L, L) [line 4]
│  │  │  Unifications:
│  │  │    L = [3,4]
│  │  │    L = _1224
│  │  │  => _1224 = [3,4]
│  │  └─
│  │  => _1304 = [2,3,4]
│  └─
│  => _1396 = [1,2,3,4]
│  Query Variable: X = [1,2,3,4]
└─


## Call Tree

```mermaid
graph TD

%% Nodes
A["① append([H|T], L, [H|R])<br/>clause 5<br/>EXIT: _1396=[1,2,3,4]"]
B["② append([H|T], L, [H|R])<br/>clause 5<br/>EXIT: _1304=[2,3,4]"]
C["③ append([], L, L)<br/>clause 4<br/>EXIT: _1224=[3,4]"]

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