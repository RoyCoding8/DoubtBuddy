import { SyllabusSubject } from '../types/syllabus';

export const syllabusData: readonly SyllabusSubject[] = [
  {
    id: 'physics',
    name: 'Physics',
    shortLabel: 'PHY',
    description: 'Mechanics to Modern Physics with problem-focused approach.',
    chapters: [
      {
        id: 'mechanics',
        name: 'Mechanics',
        topics: ['Kinematics', 'Newton Laws', 'Work Power Energy', 'Rotational Motion', 'COM & Momentum'],
      },
      {
        id: 'electrodynamics',
        name: 'Electrodynamics',
        topics: ['Electrostatics', 'Current Electricity', 'Magnetism', 'EMI', 'AC'],
      },
      {
        id: 'optics',
        name: 'Optics',
        topics: ['Ray Optics', 'Wave Optics', 'Optical Instruments'],
      },
      {
        id: 'thermodynamics',
        name: 'Thermodynamics',
        topics: ['Thermal Properties', 'KTG', 'Thermodynamics', 'Heat Transfer'],
      },
      {
        id: 'modern-physics',
        name: 'Modern Physics',
        topics: ['Photoelectric Effect', 'Atomic Models', 'Nuclear Physics', 'Semiconductors'],
      },
      {
        id: 'waves',
        name: 'Waves & SHM',
        topics: ['Simple Harmonic Motion', 'Wave Motion', 'Sound Waves'],
      },
    ],
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    shortLabel: 'CHEM',
    description: 'Physical, Organic and Inorganic chapter-wise clarity.',
    chapters: [
      {
        id: 'physical-chemistry',
        name: 'Physical Chemistry',
        topics: ['Mole Concept', 'Atomic Structure', 'Thermodynamics', 'Electrochemistry', 'Chemical Kinetics'],
      },
      {
        id: 'organic-chemistry',
        name: 'Organic Chemistry',
        topics: ['GOC', 'Hydrocarbons', 'Haloalkanes', 'Carbonyls', 'Amines', 'Biomolecules'],
      },
      {
        id: 'inorganic-chemistry',
        name: 'Inorganic Chemistry',
        topics: ['Periodic Table', 'Chemical Bonding', 'Coordination Compounds', 'P-Block', 'D/F Block'],
      },
    ],
  },
  {
    id: 'math',
    name: 'Mathematics',
    shortLabel: 'MATH',
    description: 'Algebra to Calculus with step-by-step derivation.',
    chapters: [
      {
        id: 'algebra',
        name: 'Algebra',
        topics: ['Quadratic Equations', 'Sequences & Series', 'Binomial Theorem', 'Complex Numbers', 'Matrices'],
      },
      {
        id: 'calculus',
        name: 'Calculus',
        topics: ['Limits', 'Continuity', 'Differentiation', 'AOD', 'Integration', 'Differential Equations'],
      },
      {
        id: 'coordinate-geometry',
        name: 'Coordinate Geometry',
        topics: ['Straight Line', 'Circle', 'Parabola', 'Ellipse', 'Hyperbola'],
      },
      {
        id: 'trigonometry',
        name: 'Trigonometry',
        topics: ['Identities', 'Inverse Trigonometry', 'Heights & Distances'],
      },
      {
        id: 'vectors-3d',
        name: 'Vectors & 3D',
        topics: ['Vector Algebra', '3D Geometry', 'Line and Plane'],
      },
      {
        id: 'probability',
        name: 'Probability & Statistics',
        topics: ['Permutation Combination', 'Probability', 'Bayes Theorem', 'Statistics'],
      },
    ],
  },
];
