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
B["🔄 Solve: 3>0, N1₀ is 3-1"]
C[/"📋 Clause 2 body:<br/>3>0, N1₀ is 3-1, factorial(N1₀, R1₀), X₀ is 3*R1₀"/]
D["🔄 Solve: N1₀ is 3-1"]
E[/"📋 Clause ? body:<br/>N1₀ is 3-1, factorial(N1₀, R1₀), X₀ is 3*R1₀"/]
F("✅ Solved: N1₀ = 2")
G["🔄 🔁 Recurse: factorial(2, R1₀) [clause 2]"]
H[/"📋 Clause 2 body:<br/>factorial(2, R1₀), X₀ is 3*R1₀"/]
I("✅ Solved: N1₀ = 2")
J["🔄 Solve: 2>0, N1₁ is 2-1"]
K[/"📋 Clause 2 body:<br/>2>0, N1₁ is 2-1, factorial(N1₁, R1₁), R1₀ is 2*R1₁, X₀ is 3*R1₀"/]
L["🔄 Solve: N1₁ is 2-1"]
M[/"📋 Clause ? body:<br/>N1₁ is 2-1, factorial(N1₁, R1₁), R1₀ is 2*R1₁, X₀ is 3*R1₀"/]
N("✅ Solved: N1₁ = 1")
O["🔄 🔁 Recurse: factorial(1, R1₁) [clause 2]"]
P[/"📋 Clause 2 body:<br/>factorial(1, R1₁), R1₀ is 2*R1₁, X₀ is 3*R1₀"/]
Q("✅ Solved: N1₁ = 1")
R["🔄 Solve: 1>0, N1₂ is 1-1"]
S[/"📋 Clause 2 body:<br/>1>0, N1₂ is 1-1, factorial(N1₂, R1₂), R1₁ is 1*R1₂, R1₀ is 2*R1₁, X₀ is 3*R1₀"/]
T["🔄 Solve: N1₂ is 1-1"]
U[/"📋 Clause ? body:<br/>N1₂ is 1-1, factorial(N1₂, R1₂), R1₁ is 1*R1₂, R1₀ is 2*R1₁, X₀ is 3*R1₀"/]
V("✅ Solved: N1₂ = 0")
W["🔄 🔁 Recurse: factorial(0, R1₂) [clause 1]"]
X[/"📋 Clause 1 body:<br/>factorial(0, R1₂), R1₁ is 1*R1₂, R1₀ is 2*R1₁, X₀ is 3*R1₀"/]
Y("✅ Solved: R1₂ = 1")
Z["🔄 Solve: R1₁ is 1*1"]
AA[/"📋 Clause 1 body:<br/>R1₁ is 1*1, R1₀ is 2*R1₁, X₀ is 3*R1₀"/]
AB("✅ Solved: R1₁ = 1")
AC["🔄 Solve: R1₀ is 2*1"]
AD[/"📋 Clause ? body:<br/>R1₀ is 2*1, X₀ is 3*R1₀"/]
AE("✅ Solved: R1₀ = 2")
AF["🔄 Solve: X₀ is 3*2"]
AG("✅ Solved: X₀ = 6")
AH(("🎉 SUCCESS<br/>Result = true"))
AI["🔄 Solve: 0>0, N1₃ is 0-1"]
AJ["🔄 Solve: false"]

%% Edges
A -->|"① clause 2"| B
B -->|"② clause body"| C
C -->|"③"| D
D -->|"④ clause body"| E
D -->|"⑤ N1₀ = 2"| F
F -->|"⑥ clause 2"| G
G -->|"⑦ clause body"| H
G -->|"⑧ N1₀ = 2"| I
I -->|"⑨ clause 2"| J
J -->|"⑩ clause body"| K
K -->|"⑪"| L
L -->|"⑫ clause body"| M
L -->|"⑬ N1₁ = 1"| N
N -->|"⑭ clause 2"| O
O -->|"⑮ clause body"| P
O -->|"⑯ N1₁ = 1"| Q
Q -->|"⑰ clause 2"| R
R -->|"⑱ clause body"| S
S -->|"⑲"| T
T -->|"⑳ clause body"| U
T -->|"(21) N1₂ = 0"| V
V -->|"(22) clause 1"| W
W -->|"(23) clause body"| X
W -->|"(24) R1₂ = 1"| Y
Y -->|"(25) clause 1"| Z
Z -->|"(26) clause body"| AA
Z -->|"(27) R1₁ = 1"| AB
AB -->|"(28) done"| AC
AC -->|"(29) clause body"| AD
AC -->|"(30) R1₀ = 2"| AE
AE -->|"(31) done"| AF
AF -->|"(32) X₀ = 6"| AG
AG -->|"(33) all done"| AH
Y -->|"(34) backtrack (clause 2)"| AI
AI -->|"(35)"| AJ

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#fff9c4,stroke:#f57f17
style C fill:#e1bee7,stroke:#7b1fa2
style D fill:#fff9c4,stroke:#f57f17
style E fill:#e1bee7,stroke:#7b1fa2
style F fill:#c8e6c9,stroke:#388e3c
style G fill:#fff9c4,stroke:#f57f17
style H fill:#e1bee7,stroke:#7b1fa2
style I fill:#c8e6c9,stroke:#388e3c
style J fill:#fff9c4,stroke:#f57f17
style K fill:#e1bee7,stroke:#7b1fa2
style L fill:#fff9c4,stroke:#f57f17
style M fill:#e1bee7,stroke:#7b1fa2
style N fill:#c8e6c9,stroke:#388e3c
style O fill:#fff9c4,stroke:#f57f17
style P fill:#e1bee7,stroke:#7b1fa2
style Q fill:#c8e6c9,stroke:#388e3c
style R fill:#fff9c4,stroke:#f57f17
style S fill:#e1bee7,stroke:#7b1fa2
style T fill:#fff9c4,stroke:#f57f17
style U fill:#e1bee7,stroke:#7b1fa2
style V fill:#c8e6c9,stroke:#388e3c
style W fill:#fff9c4,stroke:#f57f17
style X fill:#e1bee7,stroke:#7b1fa2
style Y fill:#c8e6c9,stroke:#388e3c
style Z fill:#fff9c4,stroke:#f57f17
style AA fill:#e1bee7,stroke:#7b1fa2
style AB fill:#c8e6c9,stroke:#388e3c
style AC fill:#fff9c4,stroke:#f57f17
style AD fill:#e1bee7,stroke:#7b1fa2
style AE fill:#c8e6c9,stroke:#388e3c
style AF fill:#fff9c4,stroke:#f57f17
style AG fill:#c8e6c9,stroke:#388e3c
style AH fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style AI fill:#fff9c4,stroke:#f57f17
style AJ fill:#fff9c4,stroke:#f57f17
```

### Legend

- 🎯 **Blue**: Initial query
- 🔄 **Yellow**: Currently solving goal
- ⏸️ **Gray**: Pending goals (waiting for current goal to complete)
- ✅ **Green**: Solved goal with binding
- 🎉 **Green**: Final success
- **Solid arrows**: Active execution flow
- **Dashed arrows**: Goals queued for later
- **Double arrows (green)**: Pending goal becomes active

## Step-by-Step Execution

### Step 1

**Goal:** `3>0,N1₀ is 3-1`

**Action:** Solving 3>0,N1₀ is 3-1

### Step 3

**Goal:** `N1₀ is 3-1`

**Action:** Solving N1₀ is 3-1

**Clause matched:** `N1₀/2`

### Step 6

**Goal:** `factorial(2,R1₀)`

**Action:** Solving factorial(2,R1₀)

**Clause matched:** `N1₀/2`

### Step 9

**Goal:** `2>0,N1₁ is 2-1`

**Action:** Solving 2>0,N1₁ is 2-1

### Step 11

**Goal:** `N1₁ is 2-1`

**Action:** Solving N1₁ is 2-1

**Clause matched:** `N1₁/1`

### Step 14

**Goal:** `factorial(1,R1₁)`

**Action:** Solving factorial(1,R1₁)

**Clause matched:** `N1₁/1`

### Step 17

**Goal:** `1>0,N1₂ is 1-1`

**Action:** Solving 1>0,N1₂ is 1-1

### Step 19

**Goal:** `N1₂ is 1-1`

**Action:** Solving N1₂ is 1-1

**Clause matched:** `N1₂/0`

### Step 22

**Goal:** `factorial(0,R1₂)`

**Action:** Solving factorial(0,R1₂)

**Clause matched:** `R1₂/1`

### Step 25

**Goal:** `R1₁ is 1*1`

**Action:** Solving R1₁ is 1*1

**Clause matched:** `R1₁/1`

### Step 28

**Goal:** `R1₀ is 2*1`

**Action:** Solving R1₀ is 2*1

**Clause matched:** `R1₀/2`

### Step 31

**Goal:** `X₀ is 3*2`

**Action:** Solving X₀ is 3*2

**Clause matched:** `X₀/6`

### Step 33

**Goal:** `true`

**Action:** Solving true

### Step 34

**Goal:** `0>0,N1₃ is 0-1`

**Action:** Backtracking: 0>0,N1₃ is 0-1

### Step 35

**Goal:** `false`

**Action:** Solving false


## Final Answer

```prolog
X = 6
```