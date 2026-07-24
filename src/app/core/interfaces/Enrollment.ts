export interface Enrollment {
  id: number;
  courseId: number;
  courseTitle?: string;
  studentId: number;
  studentName?: string;
  enrollmentDate: string;
  progressPercentage: number;
}
