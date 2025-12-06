# Prolog Execution Tree: t(0+1+1, A)

## Query

```prolog
t(0+1+1, A)
```

## Clauses Defined

1. `t(0+1, 1+0)`
2. `t(X+0+1, X+1+0)`
3. `t(X+1+1, Z) :- t(X+1, X1), t(X1+1, Z)`

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>t(0+1+1, A₀)"]]
B["🔄 🔁 Recurse: t(0+1, X1₀) [clause 3]"]
C["📦 Match Clause 3<br/>t(X+1+1, Z)<br/><br/>Unifications:<br/>• X+1+1 = 0+1<br/>• Z = X1₀<br/><br/>Subgoals (solve left-to-right):<br/>1. t(X+1, X1)<br/>2. t(X1+1, Z)"]
D("✅ Solved: X1₀ = 1+0")
E["🔄 🔁 Recurse: t(1+0+1, A₀) [clause 1]"]
F["📦 Match Clause 1<br/>t(0+1, 1+0)<br/><br/>Unifications:<br/>• 1+0+1 = 0+1<br/>• A₀ = 1+0"]
G("✅ Solved: A₀ = 1+1+0")
H(("🎉 SUCCESS<br/>A = 1+1+0"))
I["📦 Match Clause 2<br/>t(X+0+1, X+1+0)"]

%% Edges
A -->|"① try"| C
C -->|"②"| B
B -->|"③ X1₀ = 1+0"| D
D -->|"④ try"| F
F -->|"⑤"| E
E -->|"⑥ A₀ = 1+1+0"| G
G -->|"⑦ try"| I
I -->|"⑧"| H

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#fff9c4,stroke:#f57f17
style C fill:#ffe0b2,stroke:#e65100
style D fill:#c8e6c9,stroke:#388e3c
style E fill:#fff9c4,stroke:#f57f17
style F fill:#ffe0b2,stroke:#e65100
style G fill:#c8e6c9,stroke:#388e3c
style H fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style I fill:#ffe0b2,stroke:#e65100
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

**Goal:** `t(0+1,X1₀)`

**Action:** Solving t(0+1,X1₀)

**Clause matched:** `X1₀/1+0`

### Step 5

**Goal:** `t(1+0+1,A₀)`

**Action:** Solving t(1+0+1,A₀)

**Clause matched:** `A₀/1+1+0`

### Step 8

**Goal:** `true`

**Action:** Solving true


## Final Answer

```prolog
A = 1+1+0
```