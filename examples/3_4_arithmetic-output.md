# Prolog Execution Trace: llength([1,2,3], N)

## Query

```
llength([1,2,3], N)
```

## Clause Definitions

| Line # | Clause |
|--------|--------|
| 6 | `gcd(X, X, X)` |
| 9 | `gcd(X, Y, D) :- X < Y, Y1 is Y - X, gcd(X, Y1, D)` |
| 15 | `gcd(X, Y, D) :- Y < X, gcd(Y, X, D)` |
| 22 | `llength([], 0)` |
| 23 | `llength([_|T], N) :- llength(T, N1), N is N1 + 1` |

## Execution Timeline

┌─ Step 1: llength([1,2,3], N)
│  Clause: llength([_|T], N) [line 23]
│  Unifications:
│    _ = 1
│    T = [2,3]
│  Subgoals:
│    [1.1] llength(T, N1) → llength([2,3], N1)
│    [1.2] N is N1 + 1
│  
│  ┌─ Step 2 [Goal 1.1]: llength(T, N1) → llength([2,3], N1)
│  │  Clause: llength([_|T], N) [line 23]
│  │  Unifications:
│  │    _ = 2
│  │    T = [3]
│  │  Subgoals:
│  │    [2.1] llength(T, N1) → llength([3], N1)
│  │    [2.2] N is N1 + 1
│  │  
│  │  ┌─ Step 3 [Goal 2.1]: llength(T, N1) → llength([3], N1)
│  │  │  Clause: llength([_|T], N) [line 23]
│  │  │  Unifications:
│  │  │    _ = 3
│  │  │    T = []
│  │  │  Subgoals:
│  │  │    [3.1] llength(T, N1) → llength([], N1)
│  │  │    [3.2] N is N1 + 1
│  │  │  
│  │  │  ┌─ Step 4 [Goal 3.1]: llength(T, N1) → llength([], N1)
│  │  │  │  Fact: llength([], 0) [line 22]
│  │  │  │  => N1 = 0
│  │  │  └─
│  │  │  ┌─ Step 5 [Goal 3.2]: N is N1 + 1 → N is 0 + 1
│  │  │  │  where N1 = 0 (from Step 4)
│  │  │  │  => ? = 1 is 0+1
│  │  │  └─
│  │  │  => N1 = 1
│  │  └─
│  │  ┌─ Step 6 [Goal 2.2]: N is N1 + 1 → N is 1 + 1
│  │  │  where N1 = 1 (from Step 3)
│  │  │  => ? = 2 is 1+1
│  │  └─
│  │  => N1 = 2
│  └─
│  ┌─ Step 7 [Goal 1.2]: N is N1 + 1 → N is 2 + 1
│  │  where N1 = 2 (from Step 2)
│  │  => ? = 3 is 2+1
│  └─
│  => N = 3
│  Query Variable: N = 3
└─


## Final Answer

```
N = 3
```

_Showing first solution only._