----------------------------- MODULE SolveLifecycle -----------------------------
EXTENDS Naturals, FiniteSets

Requests == {1, 2}
Questions == {"A", "B"}
None == "none"

VARIABLES draft, phase, active, pending, used, source, visible, saved, failedFrom
vars == <<draft, phase, active, pending, used, source, visible, saved, failedFrom>>

Init ==
    /\ draft = "A"
    /\ phase = "Idle"
    /\ active = 0
    /\ pending = {}
    /\ used = {}
    /\ source = [r \in Requests |-> None]
    /\ visible = None
    /\ saved = {}
    /\ failedFrom = None

Begin(r) ==
    /\ r \in Requests \ used
    /\ phase # "Loading"
    /\ used' = used \cup {r}
    /\ pending' = pending \cup {r}
    /\ source' = [source EXCEPT ![r] = draft]
    /\ active' = r
    /\ phase' = "Loading"
    /\ visible' = None
    /\ failedFrom' = None
    /\ UNCHANGED <<draft, saved>>

Edit ==
    /\ draft' = IF draft = "A" THEN "B" ELSE "A"
    /\ phase' = "Idle"
    /\ active' = 0
    /\ visible' = None
    /\ failedFrom' = None
    /\ UNCHANGED <<pending, used, source, saved>>

LegacyEdit ==
    /\ draft' = IF draft = "A" THEN "B" ELSE "A"
    /\ UNCHANGED <<phase, active, pending, used, source, visible, saved, failedFrom>>

Complete(r) ==
    /\ r \in pending
    /\ pending' = pending \ {r}
    /\ IF phase = "Loading" /\ active = r
          THEN /\ phase' = "Answered"
               /\ visible' = source[r]
               /\ saved' = saved \cup {r}
          ELSE /\ UNCHANGED <<phase, visible, saved>>
    /\ UNCHANGED <<draft, active, used, source, failedFrom>>

Fail(r) ==
    /\ r \in pending
    /\ pending' = pending \ {r}
    /\ IF phase = "Loading" /\ active = r
          THEN /\ phase' = "Failed"
               /\ failedFrom' = source[r]
          ELSE /\ UNCHANGED <<phase, failedFrom>>
    /\ UNCHANGED <<draft, active, used, source, visible, saved>>

Next ==
    \/ \E r \in Requests: Begin(r)
    \/ Edit
    \/ \E r \in Requests: Complete(r)
    \/ \E r \in Requests: Fail(r)

LegacyNext ==
    \/ \E r \in Requests: Begin(r)
    \/ LegacyEdit
    \/ \E r \in Requests: Complete(r)
    \/ \E r \in Requests: Fail(r)

Spec == Init /\ [][Next]_vars
LegacySpec == Init /\ [][LegacyNext]_vars

TypeOK ==
    /\ draft \in Questions
    /\ phase \in {"Idle", "Loading", "Answered", "Failed"}
    /\ active \in Requests \cup {0}
    /\ pending \subseteq Requests
    /\ used \subseteq Requests
    /\ saved \subseteq used
    /\ source \in [Requests -> (Questions \cup {None})]
    /\ visible \in Questions \cup {None}
    /\ failedFrom \in Questions \cup {None}

NoStaleAnswer == phase # "Answered" \/ visible = draft
NoStaleFailure == phase # "Failed" \/ failedFrom = draft
NoDuplicateRequest == pending \subseteq used

=============================================================================