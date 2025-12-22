# Prolog Execution Trace: factorial(3, X)

## Query

```
factorial(3, X)
```

## Clause Definitions

| Line # | Clause |
|--------|--------|
| 4 | `factorial(0, 1)` |
| 5 | `factorial(N, R) :- N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1` |

## Execution Timeline

┌─ Step 1: factorial(3,_2006)
│  
│  Clause: factorial(N, R) [line 5]
│  Unifications:
│    N = 3
│    R = _2006
│  Subgoals:
│    [1.1] N > 0
│    [1.2] N1 is N - 1
│    [1.3] factorial(N1, R1)
│    [1.4] R is N * R1
│  Result: 6
│  Query Variable: X = ?
└─

┌─ Step 24: _706 is 3*2
│  ◀── Solving subgoal [1.1]
└─

┌─ Step 21: _936 is 2*1
└─

┌─ Step 18: _1166 is 1*1
└─


## Call Tree

```mermaid
graph TD

%% Nodes
A["① factorial(N, R)<br/>clause 5<br/>㉖ EXIT: _2006=6"]
B["② 3>0<br/>③ EXIT"]
C["④ _1866 is 3+ -1<br/>⑤ EXIT"]
D["⑥ factorial(N, R)<br/>clause 5<br/>㉓ EXIT: _1764=2"]
E["⑦ 2>0<br/>⑧ EXIT"]
F["⑨ _1624 is 2+ -1<br/>⑩ EXIT"]
G["⑪ factorial(N, R)<br/>clause 5<br/>⑳ EXIT: _1522=1"]
H["⑫ 1>0<br/>⑬ EXIT"]
I["⑭ _1382 is 1+ -1<br/>⑮ EXIT"]
J["⑯ factorial(0, 1)<br/>clause 4<br/>⑰ EXIT: _1280=1"]
K["⑱ _1166 is 1*1<br/>⑲ EXIT"]
L["㉑ _936 is 2*1<br/>㉒ EXIT"]
M["㉔ _706 is 3*2<br/>㉕ EXIT"]

%% Edges
A -->|"N > 0"| B
A -->|"N1 is N - 1"| C
A -->|"factorial(N1, R1)"| D
D -->|"N > 0"| E
D -->|"N1 is N - 1"| F
D -->|"factorial(N1, R1)"| G
G -->|"N > 0"| H
G -->|"N1 is N - 1"| I
G -->|"factorial(N1, R1)"| J
G -->|"R is N * R1"| K
D -->|"R is N * R1"| L
A -->|"R is N * R1"| M

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#c8e6c9,stroke:#388e3c
style C fill:#c8e6c9,stroke:#388e3c
style D fill:#c8e6c9,stroke:#388e3c
style E fill:#c8e6c9,stroke:#388e3c
style F fill:#c8e6c9,stroke:#388e3c
style G fill:#c8e6c9,stroke:#388e3c
style H fill:#c8e6c9,stroke:#388e3c
style I fill:#c8e6c9,stroke:#388e3c
style J fill:#c8e6c9,stroke:#388e3c
style K fill:#c8e6c9,stroke:#388e3c
style L fill:#c8e6c9,stroke:#388e3c
style M fill:#c8e6c9,stroke:#388e3c
```

## Final Answer

```
X = 6
```

_Showing first solution only._