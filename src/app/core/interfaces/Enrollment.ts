export interface Enrollment {
  id: string;
  courseId: string;
  courseTitle?: string;
  studentId: string;
  studentName?: string;
  enrollmentDate: string;
  progressPercentage: number;
}
