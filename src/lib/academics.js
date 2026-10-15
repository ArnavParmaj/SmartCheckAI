// Academic options for exams. SmartCheckAI currently supports one subject; other
// engineering subjects are planned and shown as "coming soon".
export const PROGRAM = 'B.E. Computer Engineering';

export const SUBJECTS = [
  { value: 'Big Data Analytics (BDA)', available: true },
  { value: 'Machine Learning', available: false },
  { value: 'Cloud Computing', available: false },
  { value: 'Database Management Systems', available: false },
];

export const DEFAULT_SUBJECT = SUBJECTS.find(s => s.available).value;

export const SEMESTERS = ['Semester I', 'Semester II', 'Semester III', 'Semester IV', 'Semester V', 'Semester VI', 'Semester VII', 'Semester VIII'];

// BDA is taught in Semester VII
export const DEFAULT_SEMESTER = 'Semester VII';
