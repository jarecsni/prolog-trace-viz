# Prolog Execution Tree: member(2, [1,2,3])

## Query

```prolog
member(2, [1,2,3])
```

## Clauses Defined

1. `member(X, [X|_])`
2. `member(X, [_|T]) :- member(X, T)`

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>member(2, [1, 2, 3])"]]
B["🔄 🔁 Recurse: member(2, [2, 3]) [clause 2]"]
C["📦 Match Clause 2<br/>member(X, [_|T])<br/><br/>Unifications:<br/>• X = 2<br/>• [2,3] = [_|T]<br/><br/>Subgoals (solve left-to-right):<br/>1. member(X, T)"]
D(("🎉 SUCCESS"))
E["📦 Match Clause 1<br/>member(X, [X|_])"]
F["🔄 🔁 Recurse: member(2, [3]) [clause 2]"]
G["🔄 🔁 Recurse: member(2, []) [clause 2]"]
H["🔄 Solve: false"]

%% Edges
A -->|"① try"| C
C -->|"②"| B
B -->|"③ try"| E
E -->|"④"| D
B -->|"⑤ backtrack (clause 2)"| F
F -->|"⑥ clause 2"| G
G -->|"⑦"| H

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#fff9c4,stroke:#f57f17
style C fill:#ffe0b2,stroke:#e65100
style D fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style E fill:#ffe0b2,stroke:#e65100
style F fill:#fff9c4,stroke:#f57f17
style G fill:#fff9c4,stroke:#f57f17
style H fill:#fff9c4,stroke:#f57f17
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

**Goal:** `member(2,[2,3])`

**Action:** Solving member(2,[2,3])

### Step 4

**Goal:** `true`

**Action:** Solving true

### Step 5

**Goal:** `member(2,[3])`

**Action:** Backtracking: member(2,[3])

### Step 6

**Goal:** `member(2,[])`

**Action:** Solving member(2,[])

### Step 7

**Goal:** `false`

**Action:** Solving false


## Final Answer

Query succeeded with no bindings.