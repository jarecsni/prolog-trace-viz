# Prolog Execution Tree: factorial(3, X)

## Query

```prolog
factorial(3, X)
```

## Clauses Defined

| Line # | Clause |
|--------|--------|
| 4 | `factorial(0, 1)` |
| 5 | `factorial(N, R) :- N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1` |

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>factorial(3, X)"]]
B["📦 Match Clause 5<br/>factorial(N, R)<br/><br/>Unifications:<br/>• X = 6<br/><br/>Subgoals:<br/>1. N > 0<br/>2. N1 is N - 1<br/>3. factorial(N1, R1)<br/>4. R is N * R1"]
C["🔄 Solve: 3>0"]
D(("🎉 SUCCESS"))
E["🔄 Solve: _1534 is 3+ -1"]
F(("🎉 SUCCESS"))
G["📦 Match Clause 5<br/>factorial(N, R)"]
H["🔄 🔁 Recurse: factorial(2, _1460) [clause 5]"]
I["🔄 Solve: 2>0"]
J(("🎉 SUCCESS"))
K["🔄 Solve: _1362 is 2+ -1"]
L(("🎉 SUCCESS"))
M["🔄 🔁 Recurse: factorial(1, _1288) [clause 5]"]
N["🔄 Solve: 1>0"]
O(("🎉 SUCCESS"))
P["🔄 Solve: _1190 is 1+ -1"]
Q(("🎉 SUCCESS"))
R["🔄 🔁 Recurse: factorial(0, _1116) [clause 4]"]
S(("🎉 SUCCESS"))
T["🔄 Solve: _1030 is 1*1"]
U(("🎉 SUCCESS"))
V["🔄 Solve: _842 is 2*1"]
W(("🎉 SUCCESS"))
X["🔄 Solve: _654 is 3*2"]
Y(("🎉 SUCCESS"))

%% Edges
A -->|"① try"| B
B -->|"②"| C
C -->|"③ success"| D
B -->|"④"| E
E -->|"⑤"| F
B -->|"⑥ backtrack"| G
G -->|"⑦ clause 5"| H
H -->|"⑧"| I
I -->|"⑨"| J
H -->|"⑩ backtrack"| K
K -->|"⑪"| L
H -->|"⑫ backtrack (clause 9)"| M
M -->|"⑬"| N
N -->|"⑭"| O
M -->|"⑮ backtrack"| P
P -->|"⑯"| Q
M -->|"⑰ backtrack (clause 8)"| R
R -->|"⑱"| S
M -->|"⑲ backtrack"| T
T -->|"⑳"| U
H -->|"(21) backtrack"| V
V -->|"(22)"| W
B -->|"(23)"| X
X -->|"(24)"| Y

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#ffe0b2,stroke:#e65100
style C fill:#fff9c4,stroke:#f57f17
style D fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style E fill:#fff9c4,stroke:#f57f17
style F fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style G fill:#ffe0b2,stroke:#e65100
style H fill:#fff9c4,stroke:#f57f17
style I fill:#fff9c4,stroke:#f57f17
style J fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style K fill:#fff9c4,stroke:#f57f17
style L fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style M fill:#fff9c4,stroke:#f57f17
style N fill:#fff9c4,stroke:#f57f17
style O fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style P fill:#fff9c4,stroke:#f57f17
style Q fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style R fill:#fff9c4,stroke:#f57f17
style S fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style T fill:#fff9c4,stroke:#f57f17
style U fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style V fill:#fff9c4,stroke:#f57f17
style W fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style X fill:#fff9c4,stroke:#f57f17
style Y fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
```

### Legend

- 🎯 **Blue**: Initial query
- 🔄 **Yellow**: Currently solving goal
- 📦 **Orange**: Clause match with unifications
- ⏸️ **Gray**: Pending goals (waiting for current goal to complete)
- ✅ **Green**: Solved goal with binding
- 🎉 **Green**: Final success
- **Solid arrows**: Active execution flow
- **Dashed arrows**: Goals queued for later
- **Double arrows (green)**: Pending goal becomes active

## Step-by-Step Execution

### Step 2

**Goal:** `3>0`

**Action:** Solving 3>0

### Step 3

**Goal:** `true`

**Action:** Solving true

### Step 4

**Goal:** `_1534 is 3+ -1`

**Action:** Backtracking: _1534 is 3+ -1

### Step 5

**Goal:** `true`

**Action:** Solving true

### Step 7

**Goal:** `factorial(2,_1460)`

**Action:** Backtracking: factorial(2,_1460)

### Step 8

**Goal:** `2>0`

**Action:** Solving 2>0

### Step 9

**Goal:** `true`

**Action:** Solving true

### Step 10

**Goal:** `_1362 is 2+ -1`

**Action:** Solving _1362 is 2+ -1

### Step 11

**Goal:** `true`

**Action:** Solving true

### Step 12

**Goal:** `factorial(1,_1288)`

**Action:** Solving factorial(1,_1288)

### Step 13

**Goal:** `1>0`

**Action:** Solving 1>0

### Step 14

**Goal:** `true`

**Action:** Solving true

### Step 15

**Goal:** `_1190 is 1+ -1`

**Action:** Solving _1190 is 1+ -1

### Step 16

**Goal:** `true`

**Action:** Solving true

### Step 17

**Goal:** `factorial(0,_1116)`

**Action:** Solving factorial(0,_1116)

### Step 18

**Goal:** `true`

**Action:** Solving true

### Step 19

**Goal:** `_1030 is 1*1`

**Action:** Solving _1030 is 1*1

### Step 20

**Goal:** `true`

**Action:** Solving true

### Step 21

**Goal:** `_842 is 2*1`

**Action:** Solving _842 is 2*1

### Step 22

**Goal:** `true`

**Action:** Solving true

### Step 23

**Goal:** `_654 is 3*2`

**Action:** Backtracking: _654 is 3*2

### Step 24

**Goal:** `true`

**Action:** Solving true


## Final Answer

Query succeeded with no bindings.