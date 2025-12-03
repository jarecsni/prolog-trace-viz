# Prolog Execution Tree: factorial(3, X)

## Query

```prolog
factorial(3, X)
```

## Clauses Defined

1. `factorial(0, 1)`
2. `factorial(N, R) :- N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1`

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>factorial(3, X₀)"]]
B["🔄 Solve: 3>0"]
C["🔄 Solve: N1₀ is 3-1"]
D["🔄 Solve: N1₀ is 3-1"]
E("✅ Solved: N1₀ = 2")
F["🔄 🔁 Recurse: factorial(2, R1₀) [clause 2]"]
G["📦 Match Clause 2<br/>factorial(N, R)<br/><br/>Unifications:<br/>• N = 2<br/>• R = R1₀<br/><br/>Subgoals (solve left-to-right):<br/>1. N > 0<br/>2. N1 is N - 1<br/>3. factorial(N1, R1)<br/>4. R is N * R1"]
H("✅ Solved: N1₀ = 2")
I["🔄 Solve: 2>0"]
J["🔄 Solve: N1₁ is 2-1"]
K["🔄 Solve: N1₁ is 2-1"]
L("✅ Solved: N1₁ = 1")
M["🔄 🔁 Recurse: factorial(1, R1₁) [clause 2]"]
N["📦 Match Clause 2<br/>factorial(N, R)<br/><br/>Unifications:<br/>• N = 1<br/>• R = R1₁<br/><br/>Subgoals (solve left-to-right):<br/>1. N > 0<br/>2. N1 is N - 1<br/>3. factorial(N1, R1)<br/>4. R is N * R1"]
O("✅ Solved: N1₁ = 1")
P["🔄 Solve: 1>0"]
Q["🔄 Solve: N1₂ is 1-1"]
R["🔄 Solve: N1₂ is 1-1"]
S("✅ Solved: N1₂ = 0")
T["🔄 🔁 Recurse: factorial(0, R1₂) [clause 1]"]
U["📦 Match Clause 1<br/>factorial(0, 1)<br/><br/>Unifications:<br/>• R1₂ = 1"]
V("✅ Solved: R1₂ = 1")
W["🔄 Solve: R1₁ is 1*1"]
X["📦 Match Clause 1<br/>factorial(0, 1)"]
Y("✅ Solved: R1₁ = 1")
Z["🔄 Solve: R1₀ is 2*1"]
AA("✅ Solved: R1₀ = 2")
AB["🔄 Solve: X₀ is 3*2"]
AC("✅ Solved: X₀ = 6")
AD(("🎉 SUCCESS<br/>Result = true"))
AE["🔄 Solve: 0>0, N1₃ is 0-1"]
AF["🔄 Solve: false"]

%% Edges
A -->|"①"| B
B -->|"② next"| C
C -->|"③"| D
D -->|"④ N1₀ = 2"| E
E -->|"⑤ try"| G
G -->|"⑥"| F
F -->|"⑦ N1₀ = 2"| H
H -->|"⑧"| I
I -->|"⑨ next"| J
J -->|"⑩"| K
K -->|"⑪ N1₁ = 1"| L
L -->|"⑫ try"| N
N -->|"⑬"| M
M -->|"⑭ N1₁ = 1"| O
O -->|"⑮"| P
P -->|"⑯ next"| Q
Q -->|"⑰"| R
R -->|"⑱ N1₂ = 0"| S
S -->|"⑲ try"| U
U -->|"⑳"| T
T -->|"(21) R1₂ = 1"| V
V -->|"(22) try"| X
X -->|"(23)"| W
W -->|"(24) R1₁ = 1"| Y
Y -->|"(25) done"| Z
Z -->|"(26) R1₀ = 2"| AA
AA -->|"(27) done"| AB
AB -->|"(28) X₀ = 6"| AC
AC -->|"(29) all done"| AD
V -->|"(30) backtrack (clause 2)"| AE
AE -->|"(31)"| AF

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#fff9c4,stroke:#f57f17
style C fill:#fff9c4,stroke:#f57f17
style D fill:#fff9c4,stroke:#f57f17
style E fill:#c8e6c9,stroke:#388e3c
style F fill:#fff9c4,stroke:#f57f17
style G fill:#ffe0b2,stroke:#e65100
style H fill:#c8e6c9,stroke:#388e3c
style I fill:#fff9c4,stroke:#f57f17
style J fill:#fff9c4,stroke:#f57f17
style K fill:#fff9c4,stroke:#f57f17
style L fill:#c8e6c9,stroke:#388e3c
style M fill:#fff9c4,stroke:#f57f17
style N fill:#ffe0b2,stroke:#e65100
style O fill:#c8e6c9,stroke:#388e3c
style P fill:#fff9c4,stroke:#f57f17
style Q fill:#fff9c4,stroke:#f57f17
style R fill:#fff9c4,stroke:#f57f17
style S fill:#c8e6c9,stroke:#388e3c
style T fill:#fff9c4,stroke:#f57f17
style U fill:#ffe0b2,stroke:#e65100
style V fill:#c8e6c9,stroke:#388e3c
style W fill:#fff9c4,stroke:#f57f17
style X fill:#ffe0b2,stroke:#e65100
style Y fill:#c8e6c9,stroke:#388e3c
style Z fill:#fff9c4,stroke:#f57f17
style AA fill:#c8e6c9,stroke:#388e3c
style AB fill:#fff9c4,stroke:#f57f17
style AC fill:#c8e6c9,stroke:#388e3c
style AD fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style AE fill:#fff9c4,stroke:#f57f17
style AF fill:#fff9c4,stroke:#f57f17
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

**Goal:** `N1₀ is 3-1`

**Action:** Solving N1₀ is 3-1

**Clause matched:** `N1₀/2`

### Step 6

**Goal:** `factorial(2,R1₀)`

**Action:** Solving factorial(2,R1₀)

**Clause matched:** `N1₀/2`

### Step 10

**Goal:** `N1₁ is 2-1`

**Action:** Solving N1₁ is 2-1

**Clause matched:** `N1₁/1`

### Step 13

**Goal:** `factorial(1,R1₁)`

**Action:** Solving factorial(1,R1₁)

**Clause matched:** `N1₁/1`

### Step 17

**Goal:** `N1₂ is 1-1`

**Action:** Solving N1₂ is 1-1

**Clause matched:** `N1₂/0`

### Step 20

**Goal:** `factorial(0,R1₂)`

**Action:** Solving factorial(0,R1₂)

**Clause matched:** `R1₂/1`

### Step 23

**Goal:** `R1₁ is 1*1`

**Action:** Solving R1₁ is 1*1

**Clause matched:** `R1₁/1`

### Step 25

**Goal:** `R1₀ is 2*1`

**Action:** Solving R1₀ is 2*1

**Clause matched:** `R1₀/2`

### Step 27

**Goal:** `X₀ is 3*2`

**Action:** Solving X₀ is 3*2

**Clause matched:** `X₀/6`

### Step 29

**Goal:** `true`

**Action:** Solving true

### Step 30

**Goal:** `0>0,N1₃ is 0-1`

**Action:** Backtracking: 0>0,N1₃ is 0-1

### Step 31

**Goal:** `false`

**Action:** Solving false


## Final Answer

```prolog
X = 6
```