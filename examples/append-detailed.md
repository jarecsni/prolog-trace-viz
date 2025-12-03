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
C["📦 Match Clause 2<br/>append([H|T], L, [H|R])<br/><br/>Unifications:<br/>• [2] = [H|T]<br/>• L = [3,4]<br/>• R₀ = [H|R]<br/><br/>Subgoals (solve left-to-right):<br/>1. append(T, L, R)"]
D("✅ Solved: R₀ = [2|R₁]")
E["🔄 🔁 Recurse: append([], [3, 4], R₁) [clause 2]"]
F["📦 Match Clause 2<br/>append([H|T], L, [H|R])<br/><br/>Unifications:<br/>• [] = [H|T]<br/>• L = [3,4]<br/>• R₁ = [H|R]<br/><br/>Subgoals (solve left-to-right):<br/>1. append(T, L, R)"]
G("✅ Solved: R₁ = [3,4]")
H(("🎉 SUCCESS<br/>Result = true"))
I["📦 Match Clause 1<br/>append([], L, L)"]

%% Edges
A -->|"① try"| C
C -->|"②"| B
B -->|"③ R₀ = [2|R₁]"| D
D -->|"④ try"| F
F -->|"⑤"| E
E -->|"⑥ R₁ = [3,4]"| G
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

**Goal:** `append([2],[3,4],R₀)`

**Action:** Solving append([2],[3,4],R₀)

**Clause matched:** `R₀/[2|R₁]`

### Step 5

**Goal:** `append([],[3,4],R₁)`

**Action:** Solving append([],[3,4],R₁)

**Clause matched:** `R₁/[3,4]`

### Step 8

**Goal:** `true`

**Action:** Solving true


## Final Answer

```prolog
X = [1|R₀]
```