----------------------------- MODULE ReviewVisibility -----------------------------
Questions == {"first", "second"}
None == "none"

VARIABLES shown, revealedFor, revealed
vars == <<shown, revealedFor, revealed>>

Init ==
    /\ shown = "first"
    /\ revealedFor = None
    /\ revealed = FALSE

Reveal ==
    /\ ~revealed
    /\ revealed' = TRUE
    /\ revealedFor' = shown
    /\ UNCHANGED shown

Hide ==
    /\ revealed
    /\ revealed' = FALSE
    /\ revealedFor' = None
    /\ UNCHANGED shown

ChangeDue ==
    /\ shown' = IF shown = "first" THEN "second" ELSE "first"
    /\ revealed' = FALSE
    /\ revealedFor' = None

LegacyChangeDue ==
    /\ shown' = IF shown = "first" THEN "second" ELSE "first"
    /\ UNCHANGED <<revealed, revealedFor>>

Next == Reveal \/ Hide \/ ChangeDue
LegacyNext == Reveal \/ Hide \/ LegacyChangeDue

Spec == Init /\ [][Next]_vars
LegacySpec == Init /\ [][LegacyNext]_vars

TypeOK ==
    /\ shown \in Questions
    /\ revealedFor \in Questions \cup {None}
    /\ revealed \in BOOLEAN

OnlyCurrentQuestionRevealed == ~revealed \/ revealedFor = shown

=============================================================================