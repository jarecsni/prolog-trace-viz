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
B["📦 Match Clause 5<br/>append([H|T], L, [H|R])<br/><br/>Unifications:<br/>• [H|T] = [1,2]<br/>• L = [3,4]<br/>• [H|R] = X<br/><br/>Subgoals:<br/>1. append(T, L, R)"]
C["🔄 🔁 Recurse: append([2], [3, 4], _978) [clause 5]"]
D["📦 Match Clause 5<br/>append([H|T], L, [H|R])<br/><br/>Unifications:<br/>• [H|T] = [2]<br/>• L = [3,4]<br/>• [H|R] = _978<br/><br/>Subgoals (solve left-to-right):<br/>1. append(T, L, R)"]
E["🔄 🔁 Recurse: append([], [3, 4], _938) [clause 4]"]
F["📦 Match Clause 4<br/>append([], L, L)<br/><br/>Unifications:<br/>• L = [3,4]<br/>• L = _938"]
G(("🎉 SUCCESS"))

%% Edges
A -->|"① try"| B
B -->|"② try"| D
D -->|"③"| C
C -->|"④ try"| F
F -->|"⑤"| E
E -->|"⑥ success"| G

%% Styles
style A fill:#e1f5ff,stroke:#01579b,stroke-width:3px
style B fill:#ffe0b2,stroke:#e65100
style C fill:#fff9c4,stroke:#f57f17
style D fill:#ffe0b2,stroke:#e65100
style E fill:#fff9c4,stroke:#f57f17
style F fill:#ffe0b2,stroke:#e65100
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

### Step 3

**Goal:** `append([2],[3,4],_978)`

**Action:** Solving append([2],[3,4],_978)

**Clause matched:** `_978 = [2,3,4]`

### Step 5

**Goal:** `append([],[3,4],_938)`

**Action:** Solving append([],[3,4],_938)

**Clause matched:** `_938 = [3,4]`

### Step 6

**Goal:** `true`

**Action:** Solving true


## Final Answer

Query succeeded with no bindings.