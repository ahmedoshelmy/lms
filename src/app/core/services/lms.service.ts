import { Injectable, inject } from '@angular/core';
import { SILENT_STATUSES } from '../interceptors/silent-statuses.token';
import { ReferenceCache } from './reference-cache.service';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, map } from 'rxjs';
import { CreateUserPayload, UpdateUserPayload, User } from '../interfaces/User';
import { StudentDetails } from '../interfaces/StudentDetails';
import { InstructorDetails, InstructorStats } from '../interfaces/InstructorDetails';
import {
  CreateAttendanceDto,
  AttendanceResponseDto,
  UpdateAttendanceDto,
  AttendanceSummaryDto,
  RegisterComplianceReport,
} from '../interfaces/Attendance';

import { ClockCheck } from '../interfaces/ClockCheck';
import { Course } from '../interfaces/Course';
import { Topic, CreateTopicPayload, UpdateTopicPayload } from '../interfaces/Topic';
import {
  CourseLevel,
  CreateCourseLevelPayload,
  UpdateCourseLevelPayload,
} from '../interfaces/CourseLevel';
import {
  Group,
  CreateGroupPayload,
  UpdateGroupPayload,
  UpdateGroupSchedulePayload,
  GenerateCustomSessionsPayload,
  CancelUpcomingSessionsPayload,
  CancelUpcomingSessionsResult,
} from '../interfaces/Group';
import { UpdateCurrentSessionNumberDto } from '../interfaces/GroupCourse';
import { DashboardOverview } from '../interfaces/DashboardOverview';
import {
  MonthlyEvaluation,
  MonthlyEvaluationSummary,
  SaveMonthlyEvaluation,
} from '../interfaces/MonthlyEvaluation';
import { InstructorWorkload } from '../interfaces/InstructorWorkload';
import {
  ScheduleSession,
  UpdateSessionPayload,
  ApplySessionForwardPayload,
  CreateStandaloneSessionPayload,
  SendScheduleDigest,
  ScheduleDigestResult,
} from '../interfaces/ScheduleSession';
import {
  GroupHistory,
  PromoteGroupNextLevelPayload,
  CancelSessionPayload,
  SessionHistoryFilter,
} from '../interfaces/History';
import {
  SessionCatalogueEntry,
  SessionSyllabus,
  StudentSessionSummary,
  UpsertSessionSyllabusPayload,
} from '../interfaces/SessionSyllabus';
import {
  AvailabilityRequest,
  AvailabilityWindowInput,
  CreateAvailabilityChangeRequest,
  CreateSlotExceptionRequest,
  CreateTimeOffRequest,
  InstructorAvailability,
  InstructorTimeOff,
  LeaveSummary,
  Room,
  UpsertRoom,
} from '../interfaces/Availability';
import {
  AvailableSlot,
  Candidate,
  CandidateStatus,
  CreateSlotHold,
  SlotHold,
  SlotHoldStatus,
  SlotSearch,
  TrialSession,
  UpsertCandidate,
} from '../interfaces/Sales';
import { slotSearchQuery } from '../utils/slot-search.utils';
import { API_URL_STORAGE_KEY, resolveApiUrl } from '../config/api-url';
import { environment } from '../../../environments/environment';

import type { BulkAttendanceItem } from '../interfaces/Attendance';

// Defined once, in the interfaces; re-exported for anything importing it from here.
export type { BulkAttendanceItem } from '../interfaces/Attendance';

type QueryValue = string | number | boolean | null | undefined;

/**
 * Query parameters, encoded, with unset ones left out. Each caller decides what
 * "unset" means for its own parameters (pass undefined to leave one out).
 *
 * Replaces query strings built by hand, which encoded nothing: a value with a
 * space or an "&" in it split the query and invented parameters.
 */
export function query(values: Record<string, QueryValue>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({
  providedIn: 'root',
})
export class LmsService {
  private http = inject(HttpClient);
  private readonly cache = inject(ReferenceCache);

  /** The address set when the app was built. */
  private defaultApiUrl = environment.apiUrl;
  private apiUrlSubject = new BehaviorSubject<string>(resolveApiUrl());

  apiUrl$ = this.apiUrlSubject.asObservable();

  /** Whether this build lets Settings point it at a different API. */
  readonly canOverrideApiUrl = environment.allowApiUrlOverride;

  /** /topics, kept by ReferenceCache: topics, courses and levels all read it. */
  private topicsList<T>(): Observable<T[]> {
    return this.cache.get(`topics:${this.getApiUrl()}`, () =>
      this.http.get<T[]>(`${this.getApiUrl()}/topics`)
    );
  }

  getApiUrl(): string {
    return this.apiUrlSubject.value;
  }

  /** Development builds only; a production build keeps its built-in address. */
  setApiUrl(url: string): void {
    this.cache.clear();
    if (!this.canOverrideApiUrl) {
      return;
    }
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(API_URL_STORAGE_KEY, cleanUrl);
    }
    this.apiUrlSubject.next(cleanUrl);
  }

  resetApiUrl(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(API_URL_STORAGE_KEY);
    }
    this.apiUrlSubject.next(this.defaultApiUrl);
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  logout(): Observable<void> {
    return this.http.post<void>(
      `${this.getApiUrl()}/auth/logout`,
      {},
      {
        withCredentials: true,
      }
    );
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  getStudents(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/students`);
  }

  getInstructors(): Observable<User[]> {
    return this.cache.get(`instructors:${this.getApiUrl()}`, () =>
      this.http.get<User[]>(`${this.getApiUrl()}/instructors`)
    );
  }

  getScheduleInstructors(): Observable<User[]> {
    return this.cache.get(`instructors:schedule:${this.getApiUrl()}`, () =>
      this.http.get<User[]>(`${this.getApiUrl()}/schedule/instructors`)
    );
  }

  createUser(payload: CreateUserPayload): Observable<User> {
    return this.http.post<User>(`${this.getApiUrl()}/users`, payload);
  }

  updateUser(id: number, payload: UpdateUserPayload): Observable<User> {
    return this.http.put<User>(`${this.getApiUrl()}/users/${id}`, payload);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/users/${id}`);
  }

  /**
   * Instructors including those who have left, for the page that manages
   * accounts. Everything else uses {@link getInstructors}, which leaves them out.
   */
  getAllInstructorAccounts(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/instructors`, {
      params: { includeDeactivated: 'true' },
    });
  }

  /**
   * Switch an account off without erasing what it did. For anybody who has
   * taught, since deleting them would erase who took their classes.
   */
  deactivateUser(id: number): Observable<void> {
    return this.http.post<void>(`${this.getApiUrl()}/users/${id}/deactivate`, {});
  }

  reactivateUser(id: number): Observable<void> {
    return this.http.post<void>(`${this.getApiUrl()}/users/${id}/reactivate`, {});
  }

  /**
   * The signed-in student's own record. Addressed by the token rather than by
   * an id, so it cannot be pointed at somebody else.
   */
  getMyStudentRecord(): Observable<StudentDetails> {
    return this.http.get<StudentDetails>(`${this.getApiUrl()}/students/me`);
  }

  getStudentDetails(id: number): Observable<StudentDetails> {
    return this.http.get<StudentDetails>(`${this.getApiUrl()}/students/${id}/details`);
  }

  getInstructorDetails(id: number): Observable<InstructorDetails> {
    return this.http.get<InstructorDetails>(`${this.getApiUrl()}/instructors/${id}/details`);
  }

  /**
   * Take a student off the renewal list, or put them back on it. Whether the
   * renewal is due is read from the course; this records only that somebody
   * has dealt with it.
   */
  setRenewalHandled(groupId: number, studentId: number, handled: boolean): Observable<void> {
    return this.http.put<void>(
      `${this.getApiUrl()}/groups/${groupId}/students/${studentId}/renewal`,
      { handled }
    );
  }

  // ── Monthly reports ──────────────────────────────────────────────────────

  /** Every report a month should have, written or not. */
  getEvaluations(
    month: string,
    filter?: { instructorId?: number; groupId?: number }
  ): Observable<MonthlyEvaluationSummary[]> {
    return this.http.get<MonthlyEvaluationSummary[]>(`${this.getApiUrl()}/evaluations`, {
      params: query({
        month,
        instructorId: filter?.instructorId || undefined,
        groupId: filter?.groupId || undefined,
      }),
    });
  }

  /**
   * One child's month. A report nobody has opened yet comes back in the same
   * shape, with everything the school knows already filled in.
   */
  getEvaluation(studentId: number, groupId: number, month: string): Observable<MonthlyEvaluation> {
    return this.http.get<MonthlyEvaluation>(
      `${this.getApiUrl()}/evaluations/student/${studentId}/group/${groupId}`,
      { params: query({ month }) }
    );
  }

  saveEvaluation(payload: SaveMonthlyEvaluation): Observable<MonthlyEvaluation> {
    return this.http.post<MonthlyEvaluation>(`${this.getApiUrl()}/evaluations`, payload);
  }

  releaseEvaluation(id: number): Observable<MonthlyEvaluation> {
    return this.http.post<MonthlyEvaluation>(`${this.getApiUrl()}/evaluations/${id}/release`, {});
  }

  withdrawEvaluation(id: number): Observable<MonthlyEvaluation> {
    return this.http.post<MonthlyEvaluation>(`${this.getApiUrl()}/evaluations/${id}/withdraw`, {});
  }

  /**
   * The front page's figures, counted on the server so that every screen
   * quoting them quotes the same number.
   */
  getDashboardOverview(): Observable<DashboardOverview> {
    return this.http.get<DashboardOverview>(`${this.getApiUrl()}/dashboard/overview`);
  }

  /**
   * Booked, offered and capped for every instructor, in one read. A stats
   * call per row would be a request per instructor.
   */
  getInstructorWorkload(): Observable<InstructorWorkload[]> {
    return this.http.get<InstructorWorkload[]>(`${this.getApiUrl()}/instructors/workload`);
  }

  getInstructorStats(id: number): Observable<InstructorStats> {
    return this.http.get<InstructorStats>(`${this.getApiUrl()}/instructors/${id}/stats`);
  }

  // ─── Topics & Course Levels ────────────────────────────────────────────────

  getTopics(): Observable<Topic[]> {
    return this.topicsList<Topic>();
  }

  getTopic(id: number): Observable<Topic> {
    return this.http.get<Topic>(`${this.getApiUrl()}/topics/${id}`);
  }

  createTopic(payload: CreateTopicPayload): Observable<Topic> {
    return this.http.post<Topic>(`${this.getApiUrl()}/topics`, payload);
  }

  updateTopic(id: number, payload: UpdateTopicPayload): Observable<Topic> {
    return this.http.put<Topic>(`${this.getApiUrl()}/topics/${id}`, payload);
  }

  deleteTopic(id: number): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/topics/${id}`);
  }

  getCourseLevels(topicId?: number): Observable<CourseLevel[]> {
    if (topicId) {
      return this.http.get<CourseLevel[]>(`${this.getApiUrl()}/topics/${topicId}/levels`);
    }
    return this.getTopics().pipe(map((topics) => (topics || []).flatMap((t) => t.levels || [])));
  }

  createCourseLevel(topicId: number, payload: CreateCourseLevelPayload): Observable<CourseLevel> {
    return this.http.post<CourseLevel>(`${this.getApiUrl()}/topics/${topicId}/levels`, payload);
  }

  updateCourseLevel(
    topicId: number,
    levelId: number,
    payload: UpdateCourseLevelPayload
  ): Observable<CourseLevel> {
    return this.http.put<CourseLevel>(
      `${this.getApiUrl()}/topics/${topicId}/levels/${levelId}`,
      payload
    );
  }

  deleteCourseLevel(topicId: number, levelId: number): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/topics/${topicId}/levels/${levelId}`);
  }

  // Backwards compatibility helper for existing course components
  getCourses(): Observable<Course[]> {
    // The same /topics list, read as courses: one request serves both.
    return this.topicsList<Course>();
  }

  // ─── Groups ──────────────────────────────────────────────────────────────

  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.getApiUrl()}/groups`);
  }

  getGroup(id: number): Observable<Group> {
    return this.http.get<Group>(`${this.getApiUrl()}/groups/${id}`);
  }

  /**
   * What the next group on this course would be called. A suggestion only —
   * the name is settled again on the server when the group is saved.
   */
  suggestGroupName(courseLevelId: number): Observable<{ name: string }> {
    return this.http.get<{ name: string }>(`${this.getApiUrl()}/groups/next-name`, {
      params: query({ courseLevelId }),
    });
  }

  createGroup(payload: CreateGroupPayload): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups`, payload);
  }

  updateGroup(id: number, payload: UpdateGroupPayload): Observable<Group> {
    return this.http.put<Group>(`${this.getApiUrl()}/groups/${id}`, payload);
  }

  deleteGroup(id: number): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/groups/${id}`);
  }

  removeStudentFromGroup(groupId: number, studentId: number): Observable<Group> {
    return this.http.delete<Group>(`${this.getApiUrl()}/groups/${groupId}/students/${studentId}`);
  }

  addCourseToGroup(groupId: number, courseLevelId: number): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups/${groupId}/courses`, {
      courseLevelId,
      courseId: courseLevelId,
    });
  }

  generateGroupCourseSessions(groupCourseId: number): Observable<{ message?: string }> {
    return this.http.post<{ message?: string }>(
      `${this.getApiUrl()}/schedule/generate-sessions/${groupCourseId}`,
      {}
    );
  }

  removeCourseFromGroup(
    groupId: number,
    groupCourseId: number,
    confirmDeleteSessions = false
  ): Observable<Group> {
    return this.http.delete<Group>(
      `${this.getApiUrl()}/groups/${groupId}/courses/${groupCourseId}`,
      {
        params: query({ confirmDeleteSessions: confirmDeleteSessions || undefined }),
      }
    );
  }

  updateGroupCourseSessions(
    groupId: number,
    groupCourseId: number,
    totalSessions: number
  ): Observable<Group> {
    return this.http.put<Group>(
      `${this.getApiUrl()}/groups/${groupId}/courses/${groupCourseId}/sessions`,
      { totalSessions }
    );
  }

  updateGroupCurrentSessionNumber(
    groupId: number,
    groupCourseId: number,
    payload: UpdateCurrentSessionNumberDto
  ): Observable<Group> {
    return this.http.put<Group>(
      `${this.getApiUrl()}/groups/${groupId}/courses/${groupCourseId}/session-number`,
      payload
    );
  }

  /** Creates the sessions a group's progress says remain. Admin only. */
  generateMissingSessions(groupId: number): Observable<Group> {
    return this.http.post<Group>(
      `${this.getApiUrl()}/groups/${groupId}/generate-missing-sessions`,
      {}
    );
  }

  /** Moves unmarked past sessions forward onto the group's pattern. Admin only. */
  /** Sets a group's progress to what its delivered sessions say. Admin only. */
  reconcileProgress(groupId: number): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups/${groupId}/reconcile-progress`, {});
  }

  rescheduleOverdueSessions(groupId: number): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups/${groupId}/reschedule-overdue`, {});
  }

  updateGroupSchedule(groupId: number, payload: UpdateGroupSchedulePayload): Observable<Group> {
    return this.http.put<Group>(`${this.getApiUrl()}/groups/${groupId}/schedule`, payload);
  }

  generateCustomSessions(payload: GenerateCustomSessionsPayload): Observable<{ message?: string }> {
    return this.http.post<{ message?: string }>(
      `${this.getApiUrl()}/schedule/generate-custom`,
      payload
    );
  }

  cancelUpcomingGroupSessions(
    groupId: number,
    payload: CancelUpcomingSessionsPayload
  ): Observable<CancelUpcomingSessionsResult> {
    return this.http.post<CancelUpcomingSessionsResult>(
      `${this.getApiUrl()}/groups/${groupId}/cancel-sessions`,
      payload
    );
  }

  // ─── Schedule & Sessions ──────────────────────────────────────────────────

  getSchedule(from?: Date, to?: Date): Observable<ScheduleSession[]> {
    return this.http.get<ScheduleSession[]>(`${this.getApiUrl()}/schedule`, {
      params: query({ from: from?.toISOString(), to: to?.toISOString() }),
    });
  }

  updateSession(id: number, payload: UpdateSessionPayload): Observable<ScheduleSession> {
    return this.http.put<ScheduleSession>(`${this.getApiUrl()}/Schedule/sessions/${id}`, payload);
  }

  applySessionForward(
    id: number,
    payload: ApplySessionForwardPayload
  ): Observable<ScheduleSession> {
    return this.http.put<ScheduleSession>(
      `${this.getApiUrl()}/Schedule/sessions/${id}/apply-forward`,
      payload
    );
  }

  createStandaloneSession(payload: CreateStandaloneSessionPayload): Observable<ScheduleSession> {
    return this.http.post<ScheduleSession>(
      `${this.getApiUrl()}/schedule/sessions/standalone`,
      payload
    );
  }

  getSessionDetails(id: number): Observable<ScheduleSession> {
    return this.http.get<ScheduleSession>(`${this.getApiUrl()}/Schedule/sessions/${id}`);
  }

  deleteSession(id: number): Observable<{ message?: string } | void> {
    return this.http.delete<{ message?: string } | void>(
      `${this.getApiUrl()}/schedule/sessions/${id}`
    );
  }

  // ─── Session syllabus ─────────────────────────────────────────────────────

  /**
   * The curriculum entry for a scheduled session, resolved by the API through
   * the session's group course. Standalone trial and makeup sessions belong to
   * no curriculum and return 404.
   */
  /**
   * A 404 here is ordinary rather than broken: a trial or makeup session belongs
   * to no curriculum, and a level may not have that session written up. The
   * caller renders nothing, so the interceptor should stay quiet about it.
   */
  getSessionSyllabus(sessionId: number): Observable<SessionSyllabus> {
    return this.http.get<SessionSyllabus>(
      `${this.getApiUrl()}/Schedule/sessions/${sessionId}/syllabus`,
      { context: new HttpContext().set(SILENT_STATUSES, [404]) }
    );
  }

  /** Every session of every course level, for browsing the whole curriculum. */
  getSessionCatalogue(): Observable<SessionCatalogueEntry[]> {
    return this.http.get<SessionCatalogueEntry[]>(`${this.getApiUrl()}/topics/sessions`);
  }

  /**
   * A student's own session history with the published summaries. Students may
   * only request their own; staff may request anyone's.
   */
  getStudentSessionSummaries(studentId: number): Observable<StudentSessionSummary[]> {
    return this.http.get<StudentSessionSummary[]>(
      `${this.getApiUrl()}/students/${studentId}/session-summaries`
    );
  }

  /** The full session-by-session syllabus for a course level. */
  getCourseLevelSyllabus(topicId: number, levelId: number): Observable<SessionSyllabus[]> {
    return this.http.get<SessionSyllabus[]>(
      `${this.getApiUrl()}/Topics/${topicId}/levels/${levelId}/sessions`
    );
  }

  /** Creates or replaces one session of a course level's syllabus. */
  upsertCourseLevelSession(
    topicId: number,
    levelId: number,
    sessionNumber: number,
    payload: UpsertSessionSyllabusPayload
  ): Observable<SessionSyllabus> {
    return this.http.put<SessionSyllabus>(
      `${this.getApiUrl()}/Topics/${topicId}/levels/${levelId}/sessions/${sessionNumber}`,
      payload
    );
  }

  // ─── Attendance ───────────────────────────────────────────────────────────

  getSessionAttendance(sessionId: number): Observable<AttendanceResponseDto[]> {
    return this.http.get<AttendanceResponseDto[]>(
      `${this.getApiUrl()}/Attendance/session/${sessionId}`
    );
  }

  createAttendance(payload: CreateAttendanceDto): Observable<AttendanceResponseDto> {
    return this.http.post<AttendanceResponseDto>(`${this.getApiUrl()}/Attendance`, payload);
  }

  updateAttendance(id: number, payload: UpdateAttendanceDto): Observable<AttendanceResponseDto> {
    return this.http.put<AttendanceResponseDto>(`${this.getApiUrl()}/Attendance/${id}`, payload);
  }

  saveBulkAttendance(sessionId: number, records: BulkAttendanceItem[]): Observable<unknown> {
    return this.http.post(`${this.getApiUrl()}/Attendance/session/${sessionId}`, records);
  }

  /**
   * Candidates sitting in on a session as a trial. Open to the instructor
   * teaching it as well as to admin, so whether a child came is recorded by
   * the person who was in the room.
   */
  getSessionTrials(sessionId: number): Observable<Candidate[]> {
    return this.http.get<Candidate[]>(`${this.getApiUrl()}/Attendance/session/${sessionId}/trials`);
  }

  recordTrialAttendance(
    sessionId: number,
    candidateId: number,
    attended: boolean
  ): Observable<Candidate> {
    return this.http.post<Candidate>(
      `${this.getApiUrl()}/Attendance/session/${sessionId}/trials/${candidateId}`,
      { attended }
    );
  }

  /** How each instructor kept their registers over a period. Admin only. */
  getRegisterCompliance(from: string, to: string): Observable<RegisterComplianceReport> {
    return this.http.get<RegisterComplianceReport>(`${this.getApiUrl()}/Attendance/compliance`, {
      params: query({ from, to }),
    });
  }

  /**
   * Sends instructors their week ahead now. The same message the Thursday job
   * sends, so a reminder pushed by hand cannot contradict the weekly one.
   */
  notifyInstructors(payload: SendScheduleDigest): Observable<ScheduleDigestResult> {
    return this.http.post<ScheduleDigestResult>(
      `${this.getApiUrl()}/schedule/notify-instructors`,
      payload
    );
  }

  /**
   * Measures every class still to come against the hour its group meets at.
   * For the morning the clocks change. Changes nothing.
   */
  checkClocks(): Observable<ClockCheck> {
    return this.http.get<ClockCheck>(`${this.getApiUrl()}/schedule/clock-check`);
  }

  /** Puts the chosen classes back to the hour their group meets at. */
  alignClocks(sessionIds: number[]): Observable<string[]> {
    return this.http.post<string[]>(`${this.getApiUrl()}/schedule/clock-align`, { sessionIds });
  }

  getAttendanceSummary(): Observable<AttendanceSummaryDto> {
    return this.http.get<AttendanceSummaryDto>(`${this.getApiUrl()}/Attendance/summary`);
  }

  // ─── Group Promotion & History ─────────────────────────────────────────────

  promoteGroupNextLevel(groupId: number, payload: PromoteGroupNextLevelPayload): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups/${groupId}/promote`, payload);
  }

  getGroupHistory(groupId: number): Observable<GroupHistory> {
    return this.http.get<GroupHistory>(`${this.getApiUrl()}/groups/${groupId}/history`);
  }

  getAllGroupsHistory(): Observable<GroupHistory[]> {
    return this.http.get<GroupHistory[]>(`${this.getApiUrl()}/groups/history`);
  }

  cancelAndShiftSession(
    sessionId: number,
    payload: CancelSessionPayload
  ): Observable<ScheduleSession> {
    return this.http.post<ScheduleSession>(
      `${this.getApiUrl()}/Schedule/sessions/${sessionId}/cancel`,
      payload
    );
  }

  getSessionHistory(filter?: SessionHistoryFilter): Observable<ScheduleSession[]> {
    return this.http.get<ScheduleSession[]>(`${this.getApiUrl()}/Schedule/history`, {
      params: query({
        groupId: filter?.groupId || undefined,
        instructorId: filter?.instructorId || undefined,
        status: filter?.status,
        from: filter?.from,
        to: filter?.to,
      }),
    });
  }

  // ── Availability ──────────────────────────────────────────────────────────

  getRooms(includeInactive = false): Observable<Room[]> {
    return this.cache.get(`rooms:${includeInactive}:${this.getApiUrl()}`, () =>
      this.http.get<Room[]>(`${this.getApiUrl()}/Availability/rooms`, {
        params: query({ includeInactive }),
      })
    );
  }

  /** Omit instructorId for the whole board, which is what the slot finder wants. */
  getInstructorAvailability(
    instructorId?: number,
    onDate?: string
  ): Observable<InstructorAvailability[]> {
    return this.http.get<InstructorAvailability[]>(`${this.getApiUrl()}/Availability/instructors`, {
      params: query({ instructorId: instructorId || undefined, onDate }),
    });
  }

  /** Admin only — everyone else asks for a change instead. */
  replaceWeeklyAvailability(
    instructorId: number,
    windows: AvailabilityWindowInput[],
    effectiveFrom?: string
  ): Observable<InstructorAvailability[]> {
    return this.http.put<InstructorAvailability[]>(
      `${this.getApiUrl()}/Availability/instructors/${instructorId}`,
      { windows, effectiveFrom: effectiveFrom ?? null }
    );
  }

  createRoom(payload: UpsertRoom): Observable<Room> {
    return this.http.post<Room>(`${this.getApiUrl()}/Availability/rooms`, payload);
  }

  updateRoom(id: number, payload: UpsertRoom): Observable<Room> {
    return this.http.put<Room>(`${this.getApiUrl()}/Availability/rooms/${id}`, payload);
  }

  /** Admin only. A month's absences per instructor, with the decisions made in it. */
  getLeaveSummary(year: number, month: number): Observable<LeaveSummary> {
    return this.http.get<LeaveSummary>(`${this.getApiUrl()}/Availability/time-off/summary`, {
      params: query({ year, month }),
    });
  }

  /** Admin only. Hours a week, or null to remove the limit. */
  setInstructorCapacity(instructorId: number, weeklyHours: number | null): Observable<void> {
    return this.http.put<void>(
      `${this.getApiUrl()}/Availability/instructors/${instructorId}/capacity`,
      { weeklyHours }
    );
  }

  getTimeOff(instructorId?: number, from?: string, to?: string): Observable<InstructorTimeOff[]> {
    return this.http.get<InstructorTimeOff[]>(`${this.getApiUrl()}/Availability/time-off`, {
      params: query({ instructorId: instructorId || undefined, from, to }),
    });
  }

  // ── Availability requests ─────────────────────────────────────────────────

  getAvailabilityRequests(status?: string, type?: string): Observable<AvailabilityRequest[]> {
    return this.http.get<AvailabilityRequest[]>(`${this.getApiUrl()}/availability/requests`, {
      params: query({ status, type }),
    });
  }

  requestTimeOff(
    payload: CreateTimeOffRequest,
    instructorId?: number
  ): Observable<AvailabilityRequest> {
    return this.http.post<AvailabilityRequest>(
      `${this.getApiUrl()}/availability/requests/time-off`,
      payload,
      { params: query({ instructorId: instructorId || undefined }) }
    );
  }

  requestAvailabilityChange(
    payload: CreateAvailabilityChangeRequest,
    instructorId?: number
  ): Observable<AvailabilityRequest> {
    return this.http.post<AvailabilityRequest>(
      `${this.getApiUrl()}/availability/requests/availability-change`,
      payload,
      { params: query({ instructorId: instructorId || undefined }) }
    );
  }

  recordTrialOutcome(candidateId: number, attended: boolean): Observable<unknown> {
    return this.http.post(`${this.getApiUrl()}/Sales/candidates/${candidateId}/trial-outcome`, {
      attended,
    });
  }

  requestSlotException(payload: CreateSlotExceptionRequest): Observable<AvailabilityRequest> {
    return this.http.post<AvailabilityRequest>(
      `${this.getApiUrl()}/availability/requests/slot-exception`,
      payload
    );
  }

  approveAvailabilityRequest(id: number, note?: string): Observable<AvailabilityRequest> {
    return this.http.post<AvailabilityRequest>(
      `${this.getApiUrl()}/availability/requests/${id}/approve`,
      { note: note ?? null }
    );
  }

  rejectAvailabilityRequest(id: number, note?: string): Observable<AvailabilityRequest> {
    return this.http.post<AvailabilityRequest>(
      `${this.getApiUrl()}/availability/requests/${id}/reject`,
      { note: note ?? null }
    );
  }

  withdrawAvailabilityRequest(id: number): Observable<AvailabilityRequest> {
    return this.http.post<AvailabilityRequest>(
      `${this.getApiUrl()}/availability/requests/${id}/withdraw`,
      {}
    );
  }

  // ── Slot finder ───────────────────────────────────────────────────────────

  /**
   * The weekly hours a new group could go into. The one answer to "is this hour
   * free", shared by the sales search and operations.
   */
  findAvailableSlots(search: SlotSearch): Observable<AvailableSlot[]> {
    return this.http.get<AvailableSlot[]>(
      `${this.getApiUrl()}/Availability/slots${slotSearchQuery(search)}`
    );
  }

  // ── Holds ─────────────────────────────────────────────────────────────────

  getSlotHolds(
    options: {
      status?: SlotHoldStatus;
      readyOnly?: boolean;
      mineOnly?: boolean;
    } = {}
  ): Observable<SlotHold[]> {
    return this.http.get<SlotHold[]>(`${this.getApiUrl()}/Sales/holds`, {
      params: query({
        status: options.status,
        readyOnly: options.readyOnly || undefined,
        mineOnly: options.mineOnly || undefined,
      }),
    });
  }

  createSlotHold(payload: CreateSlotHold): Observable<SlotHold> {
    return this.http.post<SlotHold>(`${this.getApiUrl()}/Sales/holds`, payload);
  }

  extendSlotHold(id: number, days: number): Observable<SlotHold> {
    return this.http.post<SlotHold>(`${this.getApiUrl()}/Sales/holds/${id}/extend`, { days });
  }

  releaseSlotHold(id: number, reason?: string): Observable<SlotHold> {
    return this.http.post<SlotHold>(`${this.getApiUrl()}/Sales/holds/${id}/release`, {
      reason: reason ?? null,
    });
  }

  convertSlotHold(
    id: number,
    payload: { groupName?: string | null; courseLevelId?: number | null; note?: string | null }
  ): Observable<SlotHold> {
    return this.http.post<SlotHold>(`${this.getApiUrl()}/Sales/holds/${id}/convert`, {
      ...payload,
      generateSessions: true,
    });
  }

  /** Books a candidate into the held hour so they can sit in it before deciding. */
  bookTrial(holdId: number, candidateId: number, date: string): Observable<TrialSession> {
    return this.http.post<TrialSession>(`${this.getApiUrl()}/Sales/holds/${holdId}/trial`, {
      candidateId,
      date,
    });
  }

  // ── Candidates ────────────────────────────────────────────────────────────

  getCandidates(
    options: {
      holdId?: number;
      status?: CandidateStatus;
      mineOnly?: boolean;
    } = {}
  ): Observable<Candidate[]> {
    return this.http.get<Candidate[]>(`${this.getApiUrl()}/Sales/candidates`, {
      params: query({
        holdId: options.holdId || undefined,
        status: options.status,
        mineOnly: options.mineOnly || undefined,
      }),
    });
  }

  createCandidate(payload: UpsertCandidate): Observable<Candidate> {
    return this.http.post<Candidate>(`${this.getApiUrl()}/Sales/candidates`, payload);
  }

  updateCandidate(id: number, payload: UpsertCandidate): Observable<Candidate> {
    return this.http.put<Candidate>(`${this.getApiUrl()}/Sales/candidates/${id}`, payload);
  }

  deleteCandidate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/Sales/candidates/${id}`);
  }
}
