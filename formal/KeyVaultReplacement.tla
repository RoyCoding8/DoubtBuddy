----------------------------- MODULE KeyVaultReplacement -----------------------------
Existing == "old key"
Replacement == "new key"
None == "no key"

VARIABLES stored, phase
vars == <<stored, phase>>

Init ==
    /\ stored = Existing
    /\ phase = "Ready"

BeginReplacement ==
    /\ phase = "Ready"
    /\ phase' = "Pending"
    /\ UNCHANGED stored

LegacyDelete ==
    /\ phase = "Pending"
    /\ stored' = None
    /\ phase' = "Deleted"

LegacyWriteSucceeds ==
    /\ phase = "Deleted"
    /\ stored' = Replacement
    /\ phase' = "Updated"

LegacyWriteFails ==
    /\ phase = "Deleted"
    /\ phase' = "Failed"
    /\ UNCHANGED stored

AtomicUpdateSucceeds ==
    /\ phase = "Pending"
    /\ stored' = Replacement
    /\ phase' = "Updated"

AtomicUpdateFails ==
    /\ phase = "Pending"
    /\ phase' = "Failed"
    /\ UNCHANGED stored

Done ==
    /\ phase \in {"Failed", "Updated"}
    /\ UNCHANGED vars

Next ==
    \/ BeginReplacement
    \/ AtomicUpdateSucceeds
    \/ AtomicUpdateFails
    \/ Done

LegacyNext ==
    \/ BeginReplacement
    \/ LegacyDelete
    \/ LegacyWriteSucceeds
    \/ LegacyWriteFails
    \/ Done

Spec == Init /\ [][Next]_vars
LegacySpec == Init /\ [][LegacyNext]_vars

TypeOK ==
    /\ stored \in {Existing, Replacement, None}
    /\ phase \in {"Ready", "Pending", "Deleted", "Failed", "Updated"}

FailedUpdateKeepsOldKey == phase # "Failed" \/ stored = Existing
SuccessfulUpdateInstallsNewKey == phase # "Updated" \/ stored = Replacement

=============================================================================