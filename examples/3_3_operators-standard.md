# Prolog Execution Tree: t(0+1+1, B)

## Query

```prolog
t(0+1+1, B)
```

## Clauses Defined

**Line 5:** `test1 :- Term = (jimmy plays football and squash), write('Pretty: '), write(Term), nl, write('Canonical: '), write_canonical(Term), nl`
**Line 10:** `test2 :- Term = (susan plays tennis and basketball and volleyball), write('Pretty: '), write(Term), nl, write('Canonical: '), write_canonical(Term), nl`
**Line 19:** `diana was the secretary of the department`
**Line 20:** `test3 :- Term = (diana was the secretary of the department), write('Pretty: '), write(Term), nl, write('Canonical: '), write_canonical(Term), nl`
**Line 26:** `t(0+1, 1+0)`
**Line 27:** `t(X+0+1, X+1+0)`
**Line 28:** `t(X+1+1, Z) :- t(X+1, X1), t(X1+1, Z)`

## Search Tree Visualization

```mermaid
graph TD

%% Nodes
A[["🎯 QUERY<br/>t(0+1+1, B)"]]
B("✅ Solved: B = 1+1+0")
C["🔄 🔁 Recurse: t(0+1, _918) [clause 26]"]
D("✅ Solved: B = 1+0")
E(("🎉 SUCCESS"))
F["🔄 🔁 Recurse: t(1+0+1, _792) [clause 28]"]
G(("🎉 SUCCESS"))

%% Edges
A -->|"① B = 1+1+0"| B
B -->|"② clause 30"| C
C -->|"③ B = 1+0"| D
D -->|"④ all done"| E
B -->|"⑤ clause 31"| F
F -->|"⑥"| G

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#c8e6c9,stroke:#388e3c
style C fill:#fff9c4,stroke:#f57f17
style D fill:#c8e6c9,stroke:#388e3c
style E fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
style F fill:#fff9c4,stroke:#f57f17
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

**Goal:** `t(0+1,_918)`

**Action:** Solving t(0+1,_918)

**Clause matched:** `_918 = 1+0`

### Step 4

**Goal:** `true`

**Action:** Solving true

### Step 5

**Goal:** `t(1+0+1,_792)`

**Action:** Backtracking: t(1+0+1,_792)

### Step 6

**Goal:** `true`

**Action:** Solving true


## Final Answer

Query succeeded with no bindings.