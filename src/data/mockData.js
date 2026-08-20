// Mock data for SmartCheckAI application

export const mockUser = {
  id: 'teacher-001',
  name: 'Dr. Priya Sharma',
  email: 'priya.sharma@greenwood.edu',
  role: 'Teacher',
  avatar: null,
  school: 'Greenwood Academy',
  subject: 'Mathematics & Science',
  academicYear: '2023-24',
};

export const mockExams = [
  {
    id: 'exam-001',
    title: 'Mid-term Algebra',
    subject: 'Mathematics',
    grade: 'Grade 9',
    dateCreated: '2023-10-12',
    dateEvaluated: '2023-10-14',
    status: 'Completed',
    totalStudents: 32,
    submissionsEvaluated: 32,
    pendingReview: 0,
    avgScore: 78,
    maxScore: 100,
    avgConfidence: 94,
    questions: [
      { id: 'q1', text: 'Solve for x: 2x + 5 = 17', maxMarks: 5, type: 'short' },
      { id: 'q2', text: 'Factorize: x² - 9x + 18', maxMarks: 8, type: 'short' },
      { id: 'q3', text: 'A train travels at 60 km/h for 2.5 hours. What is the total distance?', maxMarks: 7, type: 'short' },
      { id: 'q4', text: 'Simplify: (3x² + 2x - 1) + (x² - 4x + 6)', maxMarks: 10, type: 'long' },
    ]
  },
  {
    id: 'exam-002',
    title: 'History Quiz #4',
    subject: 'History',
    grade: 'Grade 10',
    dateCreated: '2023-10-14',
    dateEvaluated: null,
    status: 'Processing',
    totalStudents: 28,
    submissionsEvaluated: 18,
    pendingReview: 10,
    avgScore: null,
    maxScore: 50,
    avgConfidence: 88,
    questions: [
      { id: 'q1', text: 'Briefly describe the causes of World War I.', maxMarks: 10, type: 'long' },
      { id: 'q2', text: 'What was the significance of the Treaty of Versailles?', maxMarks: 15, type: 'long' },
      { id: 'q3', text: 'Name three countries that were part of the Triple Entente.', maxMarks: 6, type: 'short' },
    ]
  },
  {
    id: 'exam-003',
    title: 'Final Physics Paper',
    subject: 'Science',
    grade: 'Grade 11',
    dateCreated: '2023-10-15',
    dateEvaluated: null,
    status: 'Needs Review',
    totalStudents: 25,
    submissionsEvaluated: 25,
    pendingReview: 3,
    avgScore: 82,
    maxScore: 100,
    avgConfidence: 76,
    questions: [
      { id: 'q1', text: 'State Newton\'s Second Law of Motion and give an example.', maxMarks: 10, type: 'long' },
      { id: 'q2', text: 'Calculate the kinetic energy of a 5 kg object moving at 10 m/s.', maxMarks: 8, type: 'short' },
      { id: 'q3', text: 'Explain the difference between scalar and vector quantities with examples.', maxMarks: 12, type: 'long' },
    ]
  },
  {
    id: 'exam-004',
    title: 'Chemistry Lab Prep',
    subject: 'Science',
    grade: 'Grade 10',
    dateCreated: '2023-10-16',
    dateEvaluated: null,
    status: 'Draft',
    totalStudents: 30,
    submissionsEvaluated: 0,
    pendingReview: 0,
    avgScore: null,
    maxScore: 40,
    avgConfidence: null,
    questions: []
  },
  {
    id: 'exam-005',
    title: 'English Literature Essay',
    subject: 'English',
    grade: 'Grade 12',
    dateCreated: '2023-10-10',
    dateEvaluated: '2023-10-13',
    status: 'Completed',
    totalStudents: 20,
    submissionsEvaluated: 20,
    pendingReview: 0,
    avgScore: 85,
    maxScore: 100,
    avgConfidence: 91,
    questions: [
      { id: 'q1', text: 'Analyze the themes of ambition and power in Shakespeare\'s Macbeth.', maxMarks: 30, type: 'essay' },
    ]
  },
];

export const mockStudentSubmissions = [
  {
    id: 'sub-001',
    examId: 'exam-001',
    studentName: 'Rahul Verma',
    rollNumber: 'A001',
    status: 'Approved',
    totalScore: 25,
    maxScore: 30,
    percentage: 83,
    aiConfidence: 96,
    teacherApproved: true,
    ocrAccuracy: 98,
    scanUrl: 'https://images.unsplash.com/photo-1508780709619-79562169bc64?w=600&q=80',
    answers: [
      {
        questionId: 'q1',
        questionText: 'Solve for x: 2x + 5 = 17',
        maxMarks: 5,
        ocrText: 'x = 6. Working: 2x = 17 - 5 = 12, therefore x = 6.',
        aiScore: 5,
        teacherScore: 5,
        aiConfidence: 98,
        aiRationale: 'Student has correctly solved for x using algebraic transposition. All steps shown, answer is correct.',
        isOverridden: false,
        teacherNote: '',
      },
      {
        questionId: 'q2',
        questionText: 'Factorize: x² - 9x + 18',
        maxMarks: 8,
        ocrText: '(x - 3)(x - 6). Finding numbers that multiply to 18 and add to -9: -3 and -6.',
        aiScore: 8,
        teacherScore: 8,
        aiConfidence: 94,
        aiRationale: 'Correct factorization with clear workings. Both factors identified correctly.',
        isOverridden: false,
        teacherNote: '',
      },
      {
        questionId: 'q3',
        questionText: 'A train travels at 60 km/h for 2.5 hours. What is the total distance?',
        maxMarks: 7,
        ocrText: 'Distance = speed × time = 60 × 2.5 = 150 km.',
        aiScore: 7,
        teacherScore: 7,
        aiConfidence: 99,
        aiRationale: 'Correct formula applied. Calculation is accurate. Distance correctly stated as 150 km.',
        isOverridden: false,
        teacherNote: '',
      },
      {
        questionId: 'q4',
        questionText: 'Simplify: (3x² + 2x - 1) + (x² - 4x + 6)',
        maxMarks: 10,
        ocrText: '4x² - 2x + 5',
        aiScore: 5,
        teacherScore: 5,
        aiConfidence: 72,
        aiRationale: 'Answer is correct (4x² - 2x + 5) but no working steps shown. Deducting 5 marks for missing methodology.',
        isOverridden: false,
        teacherNote: '',
      },
    ]
  },
  {
    id: 'sub-002',
    examId: 'exam-001',
    studentName: 'Aisha Khan',
    rollNumber: 'A002',
    status: 'Needs Review',
    totalScore: 22,
    maxScore: 30,
    percentage: 73,
    aiConfidence: 79,
    teacherApproved: false,
    ocrAccuracy: 91,
    scanUrl: 'https://images.unsplash.com/photo-1531592937781-344ad608fabf?w=600&q=80',
    answers: [
      {
        questionId: 'q1',
        questionText: 'Solve for x: 2x + 5 = 17',
        maxMarks: 5,
        ocrText: 'x = 6',
        aiScore: 4,
        teacherScore: null,
        aiConfidence: 81,
        aiRationale: 'Correct answer but working steps are minimal. Awarding 4/5 as per rubric requiring step-by-step solution.',
        isOverridden: false,
        teacherNote: '',
      },
      {
        questionId: 'q2',
        questionText: 'Factorize: x² - 9x + 18',
        maxMarks: 8,
        ocrText: '(x - 3)(x - 5)... wait, that\'s wrong. (x - 3)(x - 6)',
        aiScore: 6,
        teacherScore: null,
        aiConfidence: 68,
        aiRationale: 'Student initially wrote wrong factors then corrected. OCR shows crossed-out text. Partial credit given for correct final answer but self-correction process noted.',
        isOverridden: false,
        teacherNote: '',
      },
      {
        questionId: 'q3',
        questionText: 'A train travels at 60 km/h for 2.5 hours. What is the total distance?',
        maxMarks: 7,
        ocrText: 'Distance = 60 + 2.5 = 62.5 km',
        aiScore: 1,
        teacherScore: null,
        aiConfidence: 95,
        aiRationale: 'Incorrect formula used. Student added speed and time instead of multiplying. Only credit given for identifying distance formula intent.',
        isOverridden: false,
        teacherNote: '',
      },
      {
        questionId: 'q4',
        questionText: 'Simplify: (3x² + 2x - 1) + (x² - 4x + 6)',
        maxMarks: 10,
        ocrText: '4x² - 2x + 5 because 3+1=4, 2+(-4)=-2, -1+6=5',
        aiScore: 10,
        teacherScore: null,
        aiConfidence: 97,
        aiRationale: 'Perfect answer with complete step-by-step working. Each term correctly combined.',
        isOverridden: false,
        teacherNote: '',
      },
    ]
  },
  {
    id: 'sub-003',
    examId: 'exam-003',
    studentName: 'Preethi Nair',
    rollNumber: 'B003',
    status: 'Needs Review',
    totalScore: 18,
    maxScore: 30,
    percentage: 60,
    aiConfidence: 71,
    teacherApproved: false,
    ocrAccuracy: 87,
    scanUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80',
    answers: [
      {
        questionId: 'q1',
        questionText: 'State Newton\'s Second Law of Motion and give an example.',
        maxMarks: 10,
        ocrText: 'Force equals mass times accleration. F = ma. Example: pushing a cart.',
        aiScore: 7,
        teacherScore: null,
        aiConfidence: 83,
        aiRationale: 'Correct law stated. Example is valid but brief. Deducting 3 marks for insufficient elaboration of the example.',
        isOverridden: false,
        teacherNote: '',
      },
      {
        questionId: 'q2',
        questionText: 'Calculate the kinetic energy of a 5 kg object moving at 10 m/s.',
        maxMarks: 8,
        ocrText: 'KE = 0.5 × m × v² = 0.5 × 5 × 100 = 250 J',
        aiScore: 8,
        teacherScore: null,
        aiConfidence: 99,
        aiRationale: 'Perfect answer. Correct formula, correct substitution, correct calculation with units.',
        isOverridden: false,
        teacherNote: '',
      },
      {
        questionId: 'q3',
        questionText: 'Explain the difference between scalar and vector quantities with examples.',
        maxMarks: 12,
        ocrText: 'Scalar has only magnitude like tempreture. Vector has magnitude and direction like velocity.',
        aiScore: 3,
        teacherScore: null,
        aiConfidence: 58,
        aiRationale: 'Basic understanding shown but very limited. Only one example each given, no detailed explanation. OCR confidence low on some words.',
        isOverridden: false,
        teacherNote: '',
      },
    ]
  },
];

export const mockAuditEvents = [
  {
    id: 'audit-001',
    timestamp: '2023-10-14T09:32:11Z',
    event: 'AI Evaluation Complete',
    actor: 'SmartCheckAI System',
    actorType: 'system',
    examTitle: 'Mid-term Algebra',
    detail: 'AI evaluated 32 student submissions with 94% average confidence.',
    examId: 'exam-001',
    severity: 'info',
  },
  {
    id: 'audit-002',
    timestamp: '2023-10-14T10:15:42Z',
    event: 'Teacher Score Override',
    actor: 'Dr. Priya Sharma',
    actorType: 'teacher',
    examTitle: 'Mid-term Algebra',
    detail: 'Modified Q4 score for student Rahul Verma from 7/10 to 5/10. Note: Methodology not shown.',
    examId: 'exam-001',
    severity: 'warning',
  },
  {
    id: 'audit-003',
    timestamp: '2023-10-14T10:22:05Z',
    event: 'Evaluation Approved',
    actor: 'Dr. Priya Sharma',
    actorType: 'teacher',
    examTitle: 'Mid-term Algebra',
    detail: 'Approved evaluation for Rahul Verma. Final score: 25/30.',
    examId: 'exam-001',
    severity: 'success',
  },
  {
    id: 'audit-004',
    timestamp: '2023-10-14T11:00:00Z',
    event: 'OCR Text Corrected',
    actor: 'Dr. Priya Sharma',
    actorType: 'teacher',
    examTitle: 'History Quiz #4',
    detail: 'Manually corrected OCR transcription for student #A008 Q2. Word "significance" was misread as "signifficance".',
    examId: 'exam-002',
    severity: 'info',
  },
  {
    id: 'audit-005',
    timestamp: '2023-10-15T08:45:00Z',
    event: 'AI Processing Started',
    actor: 'SmartCheckAI System',
    actorType: 'system',
    examTitle: 'Final Physics Paper',
    detail: 'Initiated AI evaluation for 25 student submissions.',
    examId: 'exam-003',
    severity: 'info',
  },
  {
    id: 'audit-006',
    timestamp: '2023-10-15T09:10:12Z',
    event: 'Low Confidence Flagged',
    actor: 'SmartCheckAI System',
    actorType: 'system',
    examTitle: 'Final Physics Paper',
    detail: '3 submissions flagged for manual review due to low AI confidence (<75%).',
    examId: 'exam-003',
    severity: 'warning',
  },
  {
    id: 'audit-007',
    timestamp: '2023-10-16T14:30:00Z',
    event: 'Results Exported',
    actor: 'Dr. Priya Sharma',
    actorType: 'teacher',
    examTitle: 'Mid-term Algebra',
    detail: 'Exported gradebook as CSV. 32 student records exported.',
    examId: 'exam-001',
    severity: 'info',
  },
];

export const examQuestions = {
  'exam-001': [
    { id: 'q1', text: 'Solve for x: 2x + 5 = 17', maxMarks: 5, type: 'short' },
    { id: 'q2', text: 'Factorize: x² - 9x + 18', maxMarks: 8, type: 'short' },
    { id: 'q3', text: 'A train travels at 60 km/h for 2.5 hours. What is the total distance?', maxMarks: 7, type: 'short' },
    { id: 'q4', text: 'Simplify: (3x² + 2x - 1) + (x² - 4x + 6)', maxMarks: 10, type: 'long' },
  ],
  'exam-002': [
    { id: 'q1', text: 'Briefly describe the causes of World War I.', maxMarks: 10, type: 'long' },
    { id: 'q2', text: 'What was the significance of the Treaty of Versailles?', maxMarks: 15, type: 'long' },
    { id: 'q3', text: 'Name three countries that were part of the Triple Entente.', maxMarks: 6, type: 'short' },
  ],
  'exam-003': [
    { id: 'q1', text: 'State Newton\'s Second Law of Motion and give an example.', maxMarks: 10, type: 'long' },
    { id: 'q2', text: 'Calculate the kinetic energy of a 5 kg object moving at 10 m/s.', maxMarks: 8, type: 'short' },
    { id: 'q3', text: 'Explain the difference between scalar and vector quantities with examples.', maxMarks: 12, type: 'long' },
  ],
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'Completed': return 'badge-completed';
    case 'Processing': return 'badge-processing';
    case 'Needs Review': return 'badge-review';
    case 'Draft': return 'badge-draft';
    default: return 'badge-draft';
  }
};

export const getConfidenceClass = (confidence) => {
  if (confidence >= 90) return 'confidence-high';
  if (confidence >= 70) return 'confidence-medium';
  return 'confidence-low';
};

export const getConfidenceLabel = (confidence) => {
  if (confidence >= 90) return 'High Confidence';
  if (confidence >= 70) return 'Medium Confidence';
  return 'Low Confidence';
};
