# Prolog Execution Tree: member(X, [1,2,3])

## Query

```prolog
member(X, [1,2,3])
```

## Clauses Defined

1. `member(X, [X|_])`
2. `member(X, [_|T]) :- member(X, T)`

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>member(X₀, [1, 2, 3])"]]
B(("🎉 SUCCESS<br/>Result = true"))
C["🔄 🔁 Recurse: member(X₀, [2, 3]) [clause 2]"]
D(("🎉 SUCCESS<br/>Result = true"))
E["🔄 🔁 Recurse: member(X₀, [3]) [clause 2]"]
F(("🎉 SUCCESS<br/>Result = true"))
G["🔄 🔁 Recurse: member(X₀, []) [clause 2]"]
H["🔄 Solve: false"]

%% Edges
A -->|"① clause 1"| B
A -->|"② backtrack (clause 2)"| C
C -->|"③ clause 1"| D
C -->|"④ backtrack (clause 2)"| E
E -->|"⑤ clause 1"| F
E -->|"⑥ backtrack (clause 2)"| G
G -->|"⑦"| H

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style C fill:#fff9c4,stroke:#f57f17
style D fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style E fill:#fff9c4,stroke:#f57f17
style F fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style G fill:#fff9c4,stroke:#f57f17
style H fill:#fff9c4,stroke:#f57f17
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

**Goal:** `true`

**Action:** Solving true

### Step 2

**Goal:** `member(X₀,[2,3])`

**Action:** Backtracking: member(X₀,[2,3])

### Step 3

**Goal:** `true`

**Action:** Solving true

### Step 4

**Goal:** `member(X₀,[3])`

**Action:** Solving member(X₀,[3])

### Step 5

**Goal:** `true`

**Action:** Solving true

### Step 6

**Goal:** `member(X₀,[])`

**Action:** Solving member(X₀,[])

### Step 7

**Goal:** `false`

**Action:** Solving false


## Final Answer

Query succeeded with no bindings.