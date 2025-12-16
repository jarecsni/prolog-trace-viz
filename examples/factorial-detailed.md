# Prolog Execution Tree: factorial(3, X)

## Query

```prolog
factorial(3, X)
```

## Clauses Defined

**Line 4:** `factorial(0, 1)`
**Line 5:** `factorial(N, R) :- N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1`

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>factorial(3, X)"]]
B["📦 Match Clause 5<br/>factorial(N, R)<br/><br/>Unifications:<br/>• X = 6"]
C("✅ Solved: X = 6")
D["🔄 Solve: 3>0"]
E(("🎉 SUCCESS"))
F["🔄 Solve: _1534 is 3+ -1"]
G(("🎉 SUCCESS"))
H["📦 Match Clause 5<br/>factorial(N, R)"]
I["🔄 🔁 Recurse: factorial(2, _1460) [clause 5]"]
J["🔄 Solve: 2>0"]
K(("🎉 SUCCESS"))
L["🔄 Solve: _1362 is 2+ -1"]
M(("🎉 SUCCESS"))
N["🔄 🔁 Recurse: factorial(1, _1288) [clause 5]"]
O["🔄 Solve: 1>0"]
P(("🎉 SUCCESS"))
Q["🔄 Solve: _1190 is 1+ -1"]
R(("🎉 SUCCESS"))
S["🔄 🔁 Recurse: factorial(0, _1116) [clause 4]"]
T(("🎉 SUCCESS"))
U["🔄 Solve: _1030 is 1*1"]
V(("🎉 SUCCESS"))
W["🔄 Solve: _842 is 2*1"]
X(("🎉 SUCCESS"))
Y["🔄 Solve: _654 is 3*2"]
Z(("🎉 SUCCESS"))

%% Edges
A -->|"① try"| B
A -->|"② X = 6"| C
C -->|"③ done"| D
D -->|"④ success"| E
C -->|"⑤"| F
F -->|"⑥"| G
C -->|"⑦ backtrack"| H
H -->|"⑧ clause 9"| I
I -->|"⑨"| J
J -->|"⑩"| K
I -->|"⑪ backtrack"| L
L -->|"⑫"| M
I -->|"⑬ backtrack (clause 9)"| N
N -->|"⑭"| O
O -->|"⑮"| P
N -->|"⑯ backtrack"| Q
Q -->|"⑰"| R
N -->|"⑱ backtrack (clause 8)"| S
S -->|"⑲"| T
N -->|"⑳ backtrack"| U
U -->|"(21)"| V
I -->|"(22) backtrack"| W
W -->|"(23)"| X
C -->|"(24)"| Y
Y -->|"(25)"| Z

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#ffe0b2,stroke:#e65100
style C fill:#c8e6c9,stroke:#388e3c
style D fill:#fff9c4,stroke:#f57f17
style E fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style F fill:#fff9c4,stroke:#f57f17
style G fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style H fill:#ffe0b2,stroke:#e65100
style I fill:#fff9c4,stroke:#f57f17
style J fill:#fff9c4,stroke:#f57f17
style K fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style L fill:#fff9c4,stroke:#f57f17
style M fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style N fill:#fff9c4,stroke:#f57f17
style O fill:#fff9c4,stroke:#f57f17
style P fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style Q fill:#fff9c4,stroke:#f57f17
style R fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style S fill:#fff9c4,stroke:#f57f17
style T fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style U fill:#fff9c4,stroke:#f57f17
style V fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style W fill:#fff9c4,stroke:#f57f17
style X fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style Y fill:#fff9c4,stroke:#f57f17
style Z fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
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

### Step 3

**Goal:** `3>0`

**Action:** Solving 3>0

### Step 4

**Goal:** `true`

**Action:** Solving true

### Step 5

**Goal:** `_1534 is 3+ -1`

**Action:** Backtracking: _1534 is 3+ -1

### Step 6

**Goal:** `true`

**Action:** Solving true

### Step 8

**Goal:** `factorial(2,_1460)`

**Action:** Backtracking: factorial(2,_1460)

### Step 9

**Goal:** `2>0`

**Action:** Solving 2>0

### Step 10

**Goal:** `true`

**Action:** Solving true

### Step 11

**Goal:** `_1362 is 2+ -1`

**Action:** Solving _1362 is 2+ -1

### Step 12

**Goal:** `true`

**Action:** Solving true

### Step 13

**Goal:** `factorial(1,_1288)`

**Action:** Solving factorial(1,_1288)

### Step 14

**Goal:** `1>0`

**Action:** Solving 1>0

### Step 15

**Goal:** `true`

**Action:** Solving true

### Step 16

**Goal:** `_1190 is 1+ -1`

**Action:** Solving _1190 is 1+ -1

### Step 17

**Goal:** `true`

**Action:** Solving true

### Step 18

**Goal:** `factorial(0,_1116)`

**Action:** Solving factorial(0,_1116)

### Step 19

**Goal:** `true`

**Action:** Solving true

### Step 20

**Goal:** `_1030 is 1*1`

**Action:** Solving _1030 is 1*1

### Step 21

**Goal:** `true`

**Action:** Solving true

### Step 22

**Goal:** `_842 is 2*1`

**Action:** Solving _842 is 2*1

### Step 23

**Goal:** `true`

**Action:** Solving true

### Step 24

**Goal:** `_654 is 3*2`

**Action:** Backtracking: _654 is 3*2

### Step 25

**Goal:** `true`

**Action:** Solving true


## Final Answer

Query succeeded with no bindings.