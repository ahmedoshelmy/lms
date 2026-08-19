import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, catchError, map } from 'rxjs';
import { LmsService } from './lms.service';
import { Group } from '../interfaces/Group';
import { GroupCourseHistoryItem, GroupHistory } from '../interfaces/History';
import { StudentDetails } from '../interfaces/StudentDetails';
import { User } from '../interfaces/User';
import {
  CertificateCandidate,
  CertificateCourseOption,
  CertificateStudentRef,
} from '../interfaces/Certificate';
import {
  buildCertificateSerial,
  computeDurationWeeks,
  evaluateCertificateEligibility,
} from '../utils/certificate.utils';

/** The subset of a course level a certificate is built from. */
interface CourseLevelEntry {
  courseTitle: string;
  topic: string;
  level: number | string;
  totalSessions: number;
  completedAt: string | null;
  /** Whether the group is recorded as having finished this level. */
  completed: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CertificateService {
  private readonly lmsService = inject(LmsService);

  /**
   * Certificate candidates for one student, across every group they have been in.
   *
   * Every assigned course level is returned, complete or not. Incomplete levels
   * come back flagged rather than filtered out, because cohorts that predate the
   * LMS were never marked complete and still need certificates — the dialog
   * gates them behind an explicit bypass.
   *
   * Completion lives on the group's history (`isCompleted`), which `StudentDetails`
   * does not carry, so this fetches one history per distinct group the student
   * belongs to — typically one or two requests.
   */
  getCandidatesForStudent(student: StudentDetails): Observable<CertificateCandidate[]> {
    const groups = this.distinctStudentGroups(student);
    if (groups.length === 0) {
      return of([]);
    }

    return forkJoin(
      groups.map((group) =>
        forkJoin({
          history: this.lmsService.getGroupHistory(group.groupId).pipe(catchError(() => of(null))),
          // Fetched only for its weekly schedule, which sets the duration.
          detail: this.lmsService.getGroup(group.groupId).pipe(catchError(() => of(null))),
        })
      )
    ).pipe(
      map((results) =>
        results.flatMap(({ history, detail }, index) => {
          if (!history) return [];
          const group = groups[index];
          const sessionsPerWeek = detail?.schedules?.length || 1;
          return this.courseLevels(history).map((course) =>
            this.buildCandidate({
              studentId: student.id,
              studentName: student.name,
              studentEmail: student.email,
              groupId: group.groupId,
              groupName: group.groupName,
              instructorName: history.defaultInstructorName,
              attendance: student.attendanceHistory || [],
              sessionsPerWeek,
              course,
            })
          );
        })
      )
    );
  }

  /**
   * Certificate candidates for every student in a group.
   *
   * Every assigned course level is returned, complete or not — see
   * getCandidatesForStudent for why.
   *
   * Per-student attendance is only available from `/students/{id}/details`, so
   * this issues one request per enrolled student. Fine for a class-sized group;
   * revisit if groups ever grow past a few dozen students.
   */
  getCandidatesForGroup(
    group: Group,
    history: GroupHistory | null
  ): Observable<CertificateCandidate[]> {
    const students = group.students || [];
    const courses: CourseLevelEntry[] = history
      ? this.courseLevels(history)
      : (group.courses || []).map((course) => ({
          courseTitle: course.title,
          topic: course.topic,
          level: course.level,
          totalSessions: course.totalSessions,
          completedAt: null,
          completed: course.isCompleted,
        }));

    if (students.length === 0 || courses.length === 0) {
      return of([]);
    }

    const sessionsPerWeek = group.schedules?.length || 1;

    return forkJoin(
      students.map((student) =>
        this.lmsService.getStudentDetails(student.studentId).pipe(catchError(() => of(null)))
      )
    ).pipe(
      map((details) =>
        details.flatMap((detail, index) => {
          const student = students[index];
          // A failed lookup still yields candidates, marked ineligible by the
          // empty attendance history, rather than silently dropping the student.
          const attendance = detail?.attendanceHistory || [];
          return courses.map((course) =>
            this.buildCandidate({
              studentId: student.studentId,
              studentName: student.studentName,
              studentEmail: student.studentEmail,
              groupId: group.id,
              groupName: group.name,
              instructorName: history?.defaultInstructorName || group.defaultInstructorName,
              attendance,
              sessionsPerWeek,
              course,
            })
          );
        })
      )
    );
  }

  /**
   * Every course level in the catalog, flattened from topics so each option
   * carries its topic name — the nested levels the API returns do not always
   * include it.
   */
  getCourseCatalog(): Observable<CertificateCourseOption[]> {
    return this.lmsService.getTopics().pipe(
      map((topics) =>
        (topics || []).flatMap((topic) =>
          (topic.levels || []).map((level) => ({
            id: level.id,
            title: level.title,
            topic: topic.name,
            level: level.level,
            sessionCount: level.sessionCount,
          }))
        )
      )
    );
  }

  /**
   * Instructors selectable as the signatory on a certificate.
   *
   * Uses the schedule roster rather than /instructors because that endpoint is
   * reachable by instructors as well as admins. A failure yields an empty list
   * so the dialog degrades to "use the recorded instructor" instead of erroring.
   */
  getInstructorOptions(): Observable<User[]> {
    return this.lmsService.getScheduleInstructors().pipe(
      map((users) => (users || []).filter((user) => !!user?.name)),
      catchError(() => of([]))
    );
  }

  /**
   * Builds a candidate for a course the student has no enrolment record for.
   *
   * Students who finished a course before the system existed were never added
   * to a group for it, so nothing in the API can produce this candidate — it is
   * assembled from the catalog instead. It always fails the enrolment check, so
   * issuing it still requires an explicit bypass.
   */
  buildManualCandidate(
    student: CertificateStudentRef,
    course: CertificateCourseOption
  ): CertificateCandidate {
    const serial = buildCertificateSerial({
      studentId: student.id,
      groupId: null,
      courseTitle: course.title,
      topic: course.topic,
      level: course.level,
    });

    return {
      key: serial,
      serial,
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      manual: true,
      groupId: null,
      groupName: '',
      courseTitle: course.title,
      topic: course.topic,
      level: course.level,
      instructorName: '',
      completedAt: null,
      // No group means no weekly schedule; assume the usual one session a week.
      durationWeeks: computeDurationWeeks(course.sessionCount, 1),
      eligibility: {
        eligible: false,
        failedChecks: ['enrollment'],
        reasons: ['Added manually - no enrolment record exists for this course level'],
        courseCompleted: false,
        attendanceRate: 0,
        attendedSessions: 0,
        recordedSessions: 0,
        courseTotalSessions: course.sessionCount,
      },
    };
  }

  private distinctStudentGroups(student: StudentDetails): { groupId: number; groupName: string }[] {
    const all = [...(student.groupHistory || [])];
    if (student.currentGroup) {
      all.unshift(student.currentGroup);
    }

    const seen = new Set<number>();
    return all
      .filter((group) => {
        if (seen.has(group.groupId)) return false;
        seen.add(group.groupId);
        return true;
      })
      .map((group) => ({ groupId: group.groupId, groupName: group.groupName }));
  }

  private courseLevels(history: GroupHistory): CourseLevelEntry[] {
    return (history.courseHistory || []).map((course: GroupCourseHistoryItem) => ({
      courseTitle: course.courseTitle,
      topic: course.topic,
      level: course.level,
      totalSessions: course.totalSessions,
      completedAt: course.completedAt ?? null,
      completed: course.isCompleted,
    }));
  }

  private buildCandidate(input: {
    studentId: number;
    studentName: string;
    studentEmail?: string;
    groupId: number;
    groupName: string;
    instructorName: string;
    attendance: StudentDetails['attendanceHistory'];
    /** Weekly schedule slots for the group, used to derive the duration. */
    sessionsPerWeek: number;
    course: CourseLevelEntry;
  }): CertificateCandidate {
    const { course } = input;
    const eligibility = evaluateCertificateEligibility(
      input.attendance,
      course.courseTitle,
      input.groupName,
      course.totalSessions,
      course.completed
    );
    const serial = buildCertificateSerial({
      studentId: input.studentId,
      groupId: input.groupId,
      courseTitle: course.courseTitle,
      topic: course.topic,
      level: course.level,
    });

    return {
      key: serial,
      serial,
      studentId: input.studentId,
      studentName: input.studentName,
      studentEmail: input.studentEmail,
      manual: false,
      groupId: input.groupId,
      groupName: input.groupName,
      courseTitle: course.courseTitle,
      topic: course.topic,
      level: course.level,
      instructorName: input.instructorName,
      completedAt: course.completedAt,
      durationWeeks: computeDurationWeeks(course.totalSessions, input.sessionsPerWeek),
      eligibility,
    };
  }
}
