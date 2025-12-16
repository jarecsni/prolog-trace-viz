# Prolog Execution Tree: append([1,2], [3,4], X)

## Query

```prolog
append([1,2], [3,4], X)
```

## Clauses Defined

**Line 4:** `append([], L, L)`
**Line 5:** `append([H|T], L, [H|R]) :- append(T, L, R)`

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>append([1, 2], [3, 4], X)"]]
B["📦 Match Clause 5<br/>append([H|T], L, [H|R])<br/><br/>Unifications:<br/>• X = [1,2,3,4]<br/><br/>Subgoals:<br/>1. append(T, L, R)"]
C("✅ Solved: X = [1,2,3,4]")
D["🔄 🔁 Recurse: append([2], [3, 4], _1010) [clause 5]"]
E["📦 Match Clause 5<br/>append([H|T], L, [H|R])<br/><br/>Unifications:<br/>• X = [2,3,4]<br/><br/>Subgoals (solve left-to-right):<br/>1. append(T, L, R)"]
F("✅ Solved: X = [2,3,4]")
G["🔄 🔁 Recurse: append([], [3, 4], _970) [clause 4]"]
H["📦 Match Clause 4<br/>append([], L, L)<br/><br/>Unifications:<br/>• X = [3,4]"]
I("✅ Solved: X = [3,4]")
J(("🎉 SUCCESS"))

%% Edges
A -->|"① try"| B
A -->|"② X = [1,2,3,4]"| C
C -->|"③ try"| E
E -->|"④"| D
D -->|"⑤ X = [2,3,4]"| F
F -->|"⑥ try"| H
H -->|"⑦"| G
G -->|"⑧ X = [3,4]"| I
I -->|"⑨ all done"| J

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#ffe0b2,stroke:#e65100
style C fill:#c8e6c9,stroke:#388e3c
style D fill:#fff9c4,stroke:#f57f17
style E fill:#ffe0b2,stroke:#e65100
style F fill:#c8e6c9,stroke:#388e3c
style G fill:#fff9c4,stroke:#f57f17
style H fill:#ffe0b2,stroke:#e65100
style I fill:#c8e6c9,stroke:#388e3c
style J fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
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

### Step 4

**Goal:** `append([2],[3,4],_1010)`

**Action:** Solving append([2],[3,4],_1010)

**Clause matched:** `_1010 = [2,3,4]`

### Step 7

**Goal:** `append([],[3,4],_970)`

**Action:** Solving append([],[3,4],_970)

**Clause matched:** `_970 = [3,4]`

### Step 9

**Goal:** `true`

**Action:** Solving true


## Final Answer

Query succeeded with no bindings.