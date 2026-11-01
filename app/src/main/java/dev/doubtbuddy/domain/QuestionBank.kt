package dev.doubtbuddy.domain

object QuestionBank {
    val questions: List<PracticeQuestion> = listOf(
        PracticeQuestion("p01", Subject.PHYSICS, "Kinematics", "A car starts from rest and accelerates uniformly at 2 m/s². How far does it travel in 5 seconds?", listOf("10 m", "20 m", "25 m", "50 m"), 2, "Use s = ut + ½at². With u = 0, s = ½ × 2 × 25 = 25 m."),
        PracticeQuestion("p02", Subject.PHYSICS, "Newton's laws", "A net force of 12 N acts on a 3 kg body. Its acceleration is", listOf("3 m/s²", "4 m/s²", "9 m/s²", "36 m/s²"), 1, "Newton's second law gives a = F/m = 12/3 = 4 m/s²."),
        PracticeQuestion("p03", Subject.PHYSICS, "Work and energy", "The kinetic energy of a 2 kg object moving at 3 m/s is", listOf("3 J", "6 J", "9 J", "18 J"), 2, "K = ½mv² = ½ × 2 × 9 = 9 J."),
        PracticeQuestion("p04", Subject.PHYSICS, "Electricity", "Two resistors of 2 Ω and 3 Ω are in series. Their equivalent resistance is", listOf("1.2 Ω", "2.5 Ω", "5 Ω", "6 Ω"), 2, "Series resistances add: 2 + 3 = 5 Ω."),
        PracticeQuestion("p05", Subject.PHYSICS, "Optics", "A plane mirror produces an image that is", listOf("Real and inverted", "Virtual and erect", "Real and erect", "Always magnified"), 1, "A plane mirror produces a virtual, erect, laterally inverted image of the same size."),
        PracticeQuestion("p06", Subject.PHYSICS, "Waves", "Frequency is 50 Hz. The time period is", listOf("0.02 s", "0.2 s", "2 s", "50 s"), 0, "T = 1/f = 1/50 = 0.02 s."),
        PracticeQuestion("c01", Subject.CHEMISTRY, "Mole concept", "How many moles are in 18 g of water (molar mass 18 g/mol)?", listOf("0.5 mol", "1 mol", "2 mol", "18 mol"), 1, "Number of moles = mass/molar mass = 18/18 = 1."),
        PracticeQuestion("c02", Subject.CHEMISTRY, "Atomic structure", "The maximum number of electrons in the n = 2 shell is", listOf("2", "4", "8", "18"), 2, "Maximum electron capacity is 2n², so 2 × 2² = 8."),
        PracticeQuestion("c03", Subject.CHEMISTRY, "Periodic trends", "Which element is the most electronegative?", listOf("Fluorine", "Chlorine", "Oxygen", "Nitrogen"), 0, "Fluorine has the highest electronegativity on the Pauling scale."),
        PracticeQuestion("c04", Subject.CHEMISTRY, "Chemical bonding", "A bond formed by sharing electron pairs is", listOf("Ionic", "Metallic", "Covalent", "Hydrogen"), 2, "Covalent bonds are formed by atoms sharing electron pairs."),
        PracticeQuestion("c05", Subject.CHEMISTRY, "Acids and bases", "At 25 °C, a neutral aqueous solution has pH", listOf("0", "7", "10", "14"), 1, "At 25 °C, neutral water has [H+] = 10⁻⁷ mol/L and pH 7."),
        PracticeQuestion("c06", Subject.CHEMISTRY, "Organic chemistry", "The functional group in ethanol is", listOf("Carboxyl", "Hydroxyl", "Aldehyde", "Ketone"), 1, "Ethanol contains an -OH hydroxyl group."),
        PracticeQuestion("m01", Subject.MATHEMATICS, "Quadratics", "The roots of x² − 5x + 6 = 0 are", listOf("1 and 6", "−2 and −3", "2 and 3", "−1 and −6"), 2, "Factor as (x − 2)(x − 3) = 0."),
        PracticeQuestion("m02", Subject.MATHEMATICS, "Calculus", "The derivative of x³ with respect to x is", listOf("x²", "2x", "3x²", "3x³"), 2, "Apply the power rule: d(xⁿ)/dx = nxⁿ⁻¹."),
        PracticeQuestion("m03", Subject.MATHEMATICS, "Trigonometry", "sin² θ + cos² θ equals", listOf("0", "1", "2", "sin 2θ"), 1, "The Pythagorean identity gives sin² θ + cos² θ = 1."),
        PracticeQuestion("m04", Subject.MATHEMATICS, "Probability", "A fair coin is tossed twice. The probability of two heads is", listOf("1/2", "1/3", "1/4", "3/4"), 2, "Four equally likely outcomes are HH, HT, TH, TT. Exactly one is HH."),
        PracticeQuestion("m05", Subject.MATHEMATICS, "Sequences", "The 5th term of the AP 3, 7, 11, ... is", listOf("15", "17", "19", "23"), 2, "a₅ = a + 4d = 3 + 4 × 4 = 19."),
        PracticeQuestion("m06", Subject.MATHEMATICS, "Coordinate geometry", "The distance between (0,0) and (3,4) is", listOf("3", "4", "5", "7"), 2, "Distance = √(3² + 4²) = 5.")
    )

    fun forSubject(subject: Subject): List<PracticeQuestion> = questions.filter { it.subject == subject }

    fun byId(id: String): PracticeQuestion? = questions.firstOrNull { it.id == id }
}

object StudyStats {
    fun due(attempts: List<PracticeAttempt>, now: Long): List<PracticeAttempt> =
        attempts.groupBy { it.questionId }
            .values.map { group -> group.maxBy { it.completedAt } }
            .filter { it.nextReviewAt <= now }
            .sortedBy { it.nextReviewAt }

    fun accuracy(attempts: List<PracticeAttempt>): Int =
        if (attempts.isEmpty()) 0 else attempts.count { it.correct } * 100 / attempts.size
}
