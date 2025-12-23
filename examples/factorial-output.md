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
│    [1.1] N > 0 → 3 > 0
│    [1.2] N1 is N - 1 → N1 is 3 - 1
│    [1.3] factorial(N1, R1)
│    [1.4] R is N * R1 → _2006 is 3 * R1
│  Result: 6
│  Query Variable: X = 6
└─

┌─ Step 2: 3>0
│  ◀── Solving subgoal [1.1]
└─

┌─ Step 3: _1866 is 3+ -1
│  ◀── Solving subgoal [1.2]
└─

┌─ Step 4: factorial(2,_1764)
│  ◀── Solving subgoal [1.3]
│  
│  Clause: factorial(N, R) [line 5]
│  Unifications:
│    N = 2
│    R = _1764
│  Subgoals:
│    [4.1] N > 0 → 2 > 0
│    [4.2] N1 is N - 1 → N1 is 2 - 1
│    [4.3] factorial(N1, R1)
│    [4.4] R is N * R1 → _1764 is 2 * R1
│  Result: 2
│  Query Variable: X = ?
└─

┌─ Step 5: 2>0
│  ◀── Solving subgoal [4.1]
└─

┌─ Step 6: _1624 is 2+ -1
└─

┌─ Step 7: factorial(1,_1522)
│  
│  Clause: factorial(N, R) [line 5]
│  Unifications:
│    N = 1
│    R = _1522
│  Subgoals:
│    [7.1] N > 0 → 1 > 0
│    [7.2] N1 is N - 1 → N1 is 1 - 1
│    [7.3] factorial(N1, R1)
│    [7.4] R is N * R1 → _1522 is 1 * R1
│  Result: 1
│  Query Variable: X = ?
└─

┌─ Step 8: 1>0
│  ◀── Solving subgoal [7.1]
└─

┌─ Step 9: _1382 is 1+ -1
└─

┌─ Step 10: factorial(0,_1280)
│  
│  Fact: factorial(0, 1) [line 4]
│  Result: 1
│  Query Variable: X = ?
└─

┌─ Step 11: _1166 is 1*1
└─

┌─ Step 12: _936 is 2*1
└─

┌─ Step 13: _706 is 3*2
│  ◀── Solving subgoal [1.4]
└─


## Call Tree

```mermaid
graph TD

%% Nodes
A["① factorial(N, R)<br/>clause 5<br/>EXIT: _2006=6"]
B["② 3>0"]
C["③ _1866 is 3+ -1"]
D["④ factorial(N, R)<br/>clause 5<br/>EXIT: _1764=2"]
E["⑤ 2>0"]
F["⑥ _1624 is 2+ -1"]
G["⑦ factorial(N, R)<br/>clause 5<br/>EXIT: _1522=1"]
H["⑧ 1>0"]
I["⑨ _1382 is 1+ -1"]
J["⑩ factorial(0, 1)<br/>clause 4<br/>EXIT: _1280=1"]
K["⑪ _1166 is 1*1"]
L["⑫ _936 is 2*1"]
M["⑬ _706 is 3*2"]

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