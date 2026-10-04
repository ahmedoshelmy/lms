/**
 * The monthly report a parent is sent.
 *
 * Everything the school can count arrives filled in and every piece of it can
 * be typed over, because a register is not always the whole story. What cannot
 * be filled in is the judgement, and that is all an instructor should have to
 * write.
 */
export interface MonthlyEvaluation {
  /** Null until it has been saved once. */
  id?: number | null;

  studentId: number;
  studentName: string;
  groupId: number;
  groupName: string;
  courseName: string;
  courseLevel: string;

  /** The subject and level, for borrowing syllabus from another level. */
  topicId?: number | null;
  courseLevelId?: number | null;
  instructorId: number;
  instructorName: string;

  /** The month reported on, as its first day. */
  month: string;

  status: EvaluationStatus;

  technicalOverview?: string | null;

  attendanceRate: number;
  tasksRate: number;
  assignmentsRate: number;

  /** Whether each rate was typed over rather than counted. */
  attendanceRateEdited: boolean;
  tasksRateEdited: boolean;
  assignmentsRateEdited: boolean;

  recommendations?: string | null;

  ratings: EvaluationRating[];
  sessions: EvaluationSession[];
  attendance: EvaluationAttendance;

  submittedAt?: string | null;
  releasedAt?: string | null;
  releasedByName?: string | null;
}

export type EvaluationStatus = 'Draft' | 'Submitted' | 'Released';

/** The same fourteen the report prints, in the order it prints them. */
export type EvaluationMetric =
  | 'UnderstandingOfConcepts'
  | 'IndependentCoding'
  | 'DebuggingSkills'
  | 'CodeOrganization'
  | 'ProjectsCompletion'
  | 'CreativityAndInnovation'
  | 'ToolsProficiency'
  | 'Communication'
  | 'Collaboration'
  | 'PresentationConfidence'
  | 'ProblemSolving'
  | 'AttendanceAndPunctuality'
  | 'RuleAdherence'
  | 'FocusAndEngagement'
  | 'ResponseToFeedback';

export interface EvaluationRating {
  metric: EvaluationMetric;
  /** One to five. Zero means nobody has scored it yet. */
  stars: number;
}

/** One class the group had that month. */
export interface EvaluationSession {
  sessionId: number;
  sessionNumber: number;
  date: string;
  title: string;
  /** The plain-language syllabus the overview is built from. */
  parentSummary?: string | null;
  included: boolean;
  /** How this child was marked, where a register was taken. */
  attendanceStatus?: string | null;
}

/** The month as the registers have it, kept beside the figures on the report. */
export interface EvaluationAttendance {
  classesHeld: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Classes with no register taken at all. */
  notMarked: number;
  tasksAsked: number;
  tasksDone: number;
  assignmentsAsked: number;
  assignmentsDone: number;
}

export interface SaveMonthlyEvaluation {
  studentId: number;
  groupId: number;
  month: string;
  technicalOverview?: string | null;
  attendanceRate: number;
  tasksRate: number;
  assignmentsRate: number;
  recommendations?: string | null;
  ratings: EvaluationRating[];
  sessionIds: number[];
  /** True to hand it to operations. */
  submit: boolean;
}

/** A row in the month's list. */
export interface MonthlyEvaluationSummary {
  id?: number | null;
  studentId: number;
  studentName: string;
  groupId: number;
  groupName: string;
  instructorName: string;
  month: string;
  /** Draft, Submitted, Released, or NotStarted where none exists yet. */
  status: EvaluationStatus | 'NotStarted';
  classesHeld: number;
  attendanceRate: number;
  submittedAt?: string | null;
  releasedAt?: string | null;
}

/** The four sections the report prints, and what belongs in each. */
export const EVALUATION_SECTIONS: {
  title: string;
  blurb: string;
  metrics: { metric: EvaluationMetric; label: string }[];
}[] = [
  {
    title: 'Technical mastery',
    blurb: "The child's core coding and technical ability.",
    metrics: [
      { metric: 'UnderstandingOfConcepts', label: 'Understanding of concepts' },
      { metric: 'IndependentCoding', label: 'Independent coding' },
      { metric: 'DebuggingSkills', label: 'Debugging skills' },
      { metric: 'CodeOrganization', label: 'Code organisation' },
    ],
  },
  {
    title: 'Project and practical application',
    blurb: 'Putting what they have learned to work.',
    metrics: [
      { metric: 'ProjectsCompletion', label: 'Project completion' },
      { metric: 'CreativityAndInnovation', label: 'Creativity and innovation' },
      { metric: 'ToolsProficiency', label: 'Tools proficiency' },
    ],
  },
  {
    title: 'Soft skills',
    blurb: 'The non-technical skills an engineer lives on.',
    metrics: [
      { metric: 'Communication', label: 'Communication' },
      { metric: 'Collaboration', label: 'Collaboration' },
      { metric: 'PresentationConfidence', label: 'Presentation confidence' },
      { metric: 'ProblemSolving', label: 'Problem solving' },
    ],
  },
  {
    title: 'Behaviour and discipline',
    blurb: 'Conduct, and commitment to the class.',
    metrics: [
      { metric: 'AttendanceAndPunctuality', label: 'Attendance and punctuality' },
      { metric: 'FocusAndEngagement', label: 'Focus and engagement in class' },
      { metric: 'RuleAdherence', label: 'Rule adherence' },
      { metric: 'ResponseToFeedback', label: 'Response to feedback' },
    ],
  },
];

/** The standing suggestions, which the instructor may add to or ignore. */
export const RECOMMENDATION_SUGGESTIONS = [
  'Ready for next level concepts.',
  'Excellent progress, keep it up!',
  'Needs to practice typing speed.',
  "Needs to review last month's concepts.",
  'Needs to focus on independent problem solving.',
  'Needs to improve attendance and punctuality.',
];
