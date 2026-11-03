----------------------------- MODULE PhotoSelection -----------------------------
EXTENDS Naturals, FiniteSets

Photos == {1, 2}
None == 0

VARIABLES selected, pending, used, attached, errorFrom, oldAnswer
vars == <<selected, pending, used, attached, errorFrom, oldAnswer>>

Init ==
    /\ selected = None
    /\ pending = {}
    /\ used = {}
    /\ attached = None
    /\ errorFrom = None
    /\ oldAnswer = TRUE

Select(r) ==
    /\ r \in Photos \ used
    /\ selected' = r
    /\ pending' = pending \cup {r}
    /\ used' = used \cup {r}
    /\ attached' = None
    /\ errorFrom' = None
    /\ oldAnswer' = FALSE

LegacySelect(r) ==
    /\ r \in Photos \ used
    /\ selected' = r
    /\ pending' = pending \cup {r}
    /\ used' = used \cup {r}
    /\ UNCHANGED <<attached, errorFrom, oldAnswer>>

Remove ==
    /\ selected # None \/ attached # None
    /\ selected' = None
    /\ attached' = None
    /\ errorFrom' = None
    /\ oldAnswer' = FALSE
    /\ UNCHANGED <<pending, used>>

Ready(r) ==
    /\ r \in pending
    /\ pending' = pending \ {r}
    /\ IF selected = r THEN attached' = r ELSE UNCHANGED attached
    /\ UNCHANGED <<selected, used, errorFrom, oldAnswer>>

LegacyReady(r) ==
    /\ r \in pending
    /\ pending' = pending \ {r}
    /\ attached' = r
    /\ oldAnswer' = FALSE
    /\ UNCHANGED <<selected, used, errorFrom>>

Failed(r) ==
    /\ r \in pending
    /\ pending' = pending \ {r}
    /\ IF selected = r THEN errorFrom' = r ELSE UNCHANGED errorFrom
    /\ UNCHANGED <<selected, used, attached, oldAnswer>>

LegacyFailed(r) ==
    /\ r \in pending
    /\ pending' = pending \ {r}
    /\ errorFrom' = r
    /\ UNCHANGED <<selected, used, attached, oldAnswer>>

Done ==
    /\ used = Photos
    /\ pending = {}
    /\ selected = None
    /\ UNCHANGED vars

Next ==
    \/ Done
    \/ \E r \in Photos: Select(r)
    \/ Remove
    \/ \E r \in Photos: Ready(r)
    \/ \E r \in Photos: Failed(r)

LegacyNext ==
    \/ Done
    \/ \E r \in Photos: LegacySelect(r)
    \/ Remove
    \/ \E r \in Photos: LegacyReady(r)
    \/ \E r \in Photos: LegacyFailed(r)

Spec == Init /\ [][Next]_vars
LegacySpec == Init /\ [][LegacyNext]_vars

TypeOK ==
    /\ selected \in Photos \cup {None}
    /\ pending \subseteq Photos
    /\ used \subseteq Photos
    /\ attached \in Photos \cup {None}
    /\ errorFrom \in Photos \cup {None}
    /\ oldAnswer \in BOOLEAN

LatestPhotoWins == attached = None \/ attached = selected
RemovedPhotoStaysRemoved == selected # None \/ attached = None
OldErrorsCannotReturn == errorFrom = None \/ errorFrom = selected
OldAnswerClearedDuringImport == pending = {} \/ ~oldAnswer
NoUnknownPending == pending \subseteq used

=============================================================================