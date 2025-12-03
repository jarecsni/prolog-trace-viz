# Prolog Execution Tree: append([1,2], [3,4], X)

## Query

```prolog
append([1,2], [3,4], X)
```

## Clauses Defined

1. `append([], L, L)`
2. `append([H|T], L, [H|R]) :- append(T, L, R)`

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>append([1, 2], [3, 4], X₀)"]]
B["🔄 🔁 Recurse: append([2], [3, 4], R₀) [clause 2]"]
C[/"📋 Clause 2 body:<br/>append([], [3, 4], R₁)"/]
D("✅ Solved: R₀ = [2|R₁]")
E["🔄 🔁 Recurse: append([], [3, 4], R₁) [clause 2]"]
F[/"📋 Clause 2 body:<br/>append([], [3, 4], R₁)"/]
G("✅ Solved: R₁ = [3,4]")
H(("🎉 SUCCESS<br/>Result = true"))

%% Edges
A -->|"① clause 2"| B
B -->|"② clause body"| C
B -->|"③ R₀ = [2|R₁]"| D
D -->|"④ clause 2"| E
E -->|"⑤ clause body"| F
E -->|"⑥ R₁ = [3,4]"| G
G -->|"⑦ all done"| H

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#fff9c4,stroke:#f57f17
style C fill:#e1bee7,stroke:#7b1fa2
style D fill:#c8e6c9,stroke:#388e3c
style E fill:#fff9c4,stroke:#f57f17
style F fill:#e1bee7,stroke:#7b1fa2
style G fill:#c8e6c9,stroke:#388e3c
style H fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
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

**Goal:** `append([2],[3,4],R₀)`

**Action:** Solving append([2],[3,4],R₀)

**Clause matched:** `R₀/[2|R₁]`

### Step 4

**Goal:** `append([],[3,4],R₁)`

**Action:** Solving append([],[3,4],R₁)

**Clause matched:** `R₁/[3,4]`

### Step 7

**Goal:** `true`

**Action:** Solving true


## Final Answer

```prolog
X = [1|R₀]
```