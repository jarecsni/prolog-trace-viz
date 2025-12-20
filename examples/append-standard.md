# Prolog Execution Tree: append([1,2], [3,4], X)

## Query

```prolog
append([1,2], [3,4], X)
```

## Clauses Defined

| Line # | Clause |
|--------|--------|
| 4 | `append([], L, L)` |
| 5 | `append([H|T], L, [H|R]) :- append(T, L, R)` |

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>append([1, 2], [3, 4], X)"]]
B("✅ Solved: X = [1,2,3,4]")
C["🔄 🔁 Recurse: append([2], [3, 4], _1010) [clause 5]"]
D("✅ Solved: X = [2,3,4]")
E["🔄 🔁 Recurse: append([], [3, 4], _970) [clause 4]"]
F("✅ Solved: X = [3,4]")
G(("🎉 SUCCESS"))

%% Edges
A -->|"① X = [1,2,3,4]"| B
B -->|"② clause 9"| C
C -->|"③ X = [2,3,4]"| D
D -->|"④ clause 8"| E
E -->|"⑤ X = [3,4]"| F
F -->|"⑥ all done"| G

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#c8e6c9,stroke:#388e3c
style C fill:#fff9c4,stroke:#f57f17
style D fill:#c8e6c9,stroke:#388e3c
style E fill:#fff9c4,stroke:#f57f17
style F fill:#c8e6c9,stroke:#388e3c
style G fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
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

**Goal:** `append([2],[3,4],_1010)`

**Action:** Solving append([2],[3,4],_1010)

**Clause matched:** `_1010 = [2,3,4]`

### Step 4

**Goal:** `append([],[3,4],_970)`

**Action:** Solving append([],[3,4],_970)

**Clause matched:** `_970 = [3,4]`

### Step 6

**Goal:** `true`

**Action:** Solving true


## Final Answer

Query succeeded with no bindings.