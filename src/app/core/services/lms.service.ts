import { Injectable, inject } from '@angular/core';
import { SILENT_STATUSES } from '../interceptors/silent-statuses.token';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, BehaviorSubject, map } from 'rxjs';
import { Role } from '../interfaces/Role';
import { AttendanceStatus } from '../enums/AttendanceStatus';
import { LoginRequest, LoginResponse } from '../interfaces/Login';
import { CreateUserPayload, UpdateUserPayload, User } from '../interfaces/User';
import { StudentDetails } from '../interfaces/StudentDetails';
import { InstructorDetails, InstructorStats } from '../interfaces/InstructorDetails';
import {
  CreateAttendanceDto,
  AttendanceResponseDto,
  UpdateAttendanceDto,
  AttendanceSummaryDto,
} from '../interfaces/Attendance';

import { Course, CreateCoursePayload, UpdateCoursePayload } from '../interfaces/Course';
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
import { GroupCourse, UpdateCurrentSessionNumberDto } from '../interfaces/GroupCourse';
import {
  ScheduleSession,
  UpdateSessionPayload,
  ApplySessionForwardPayload,
  CreateStandaloneSessionPayload,
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

export interface BulkAttendanceItem {
  studentId: number;
  status: AttendanceStatus;
}

@Injectable({
  providedIn: 'root',
})
export class LmsService {
  private http = inject(HttpClient);

  private defaultApiUrl = 'https://mv-api.inite.tech/api';
  private apiUrlSubject = new BehaviorSubject<string>(
    (typeof window !== 'undefined' ? localStorage.getItem('lms_api_url') : null) ||
      this.defaultApiUrl
  );

  apiUrl$ = this.apiUrlSubject.asObservable();

  getApiUrl(): string {
    return this.apiUrlSubject.value;
  }

  setApiUrl(url: string): void {
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_api_url', cleanUrl);
    }
    this.apiUrlSubject.next(cleanUrl);
  }

  resetApiUrl(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lms_api_url');
    }
    this.apiUrlSubject.next(this.defaultApiUrl);
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.getApiUrl()}/auth/login`, payload, {
      withCredentials: true,
    });
  }

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
    return this.http.get<User[]>(`${this.getApiUrl()}/instructors`);
  }

  getScheduleInstructors(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/schedule/instructors`);
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

  getStudentDetails(id: number): Observable<StudentDetails> {
    return this.http.get<StudentDetails>(`${this.getApiUrl()}/students/${id}/details`);
  }

  getInstructorDetails(id: number): Observable<InstructorDetails> {
    return this.http.get<InstructorDetails>(`${this.getApiUrl()}/instructors/${id}/details`);
  }

  getInstructorStats(id: number): Observable<InstructorStats> {
    return this.http.get<InstructorStats>(`${this.getApiUrl()}/instructors/${id}/stats`);
  }

  // ─── Topics & Course Levels ────────────────────────────────────────────────

  getTopics(): Observable<Topic[]> {
    return this.http.get<Topic[]>(`${this.getApiUrl()}/topics`);
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
    return this.http.get<Course[]>(`${this.getApiUrl()}/topics`);
  }

  // ─── Groups ──────────────────────────────────────────────────────────────

  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.getApiUrl()}/groups`);
  }

  getGroup(id: number): Observable<Group> {
    return this.http.get<Group>(`${this.getApiUrl()}/groups/${id}`);
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

  generateGroupCourseSessions(groupCourseId: number): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/schedule/generate-sessions/${groupCourseId}`, {});
  }

  removeCourseFromGroup(
    groupId: number,
    groupCourseId: number,
    confirmDeleteSessions = false
  ): Observable<Group> {
    let url = `${this.getApiUrl()}/groups/${groupId}/courses/${groupCourseId}`;
    if (confirmDeleteSessions) {
      url += `?confirmDeleteSessions=true`;
    }
    return this.http.delete<Group>(url);
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

  updateGroupSchedule(groupId: number, payload: UpdateGroupSchedulePayload): Observable<Group> {
    return this.http.put<Group>(`${this.getApiUrl()}/groups/${groupId}/schedule`, payload);
  }

  generateCustomSessions(payload: GenerateCustomSessionsPayload): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/schedule/generate-custom`, payload);
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
    let url = `${this.getApiUrl()}/schedule`;
    const params: string[] = [];
    if (from) {
      params.push(`from=${from.toISOString()}`);
    }
    if (to) {
      params.push(`to=${to.toISOString()}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<ScheduleSession[]>(url);
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

  saveBulkAttendance(sessionId: number, records: BulkAttendanceItem[]): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/Attendance/session/${sessionId}`, records);
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
    let url = `${this.getApiUrl()}/Schedule/history`;
    const params: string[] = [];
    if (filter) {
      if (filter.groupId) params.push(`groupId=${filter.groupId}`);
      if (filter.instructorId) params.push(`instructorId=${filter.instructorId}`);
      if (filter.status) params.push(`status=${filter.status}`);
      if (filter.from) params.push(`from=${filter.from}`);
      if (filter.to) params.push(`to=${filter.to}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<ScheduleSession[]>(url);
  }

  // ── Availability ──────────────────────────────────────────────────────────

  getRooms(includeInactive = false): Observable<Room[]> {
    return this.http.get<Room[]>(
      `${this.getApiUrl()}/Availability/rooms?includeInactive=${includeInactive}`
    );
  }

  /** Omit instructorId for the whole board, which is what the slot finder wants. */
  getInstructorAvailability(
    instructorId?: number,
    onDate?: string
  ): Observable<InstructorAvailability[]> {
    const params: string[] = [];
    if (instructorId) params.push(`instructorId=${instructorId}`);
    if (onDate) params.push(`onDate=${onDate}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return this.http.get<InstructorAvailability[]>(
      `${this.getApiUrl()}/Availability/instructors${query}`
    );
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
    return this.http.get<LeaveSummary>(
      `${this.getApiUrl()}/Availability/time-off/summary?year=${year}&month=${month}`
    );
  }

  /** Admin only. Hours a week, or null to remove the limit. */
  setInstructorCapacity(instructorId: number, weeklyHours: number | null): Observable<void> {
    return this.http.put<void>(
      `${this.getApiUrl()}/Availability/instructors/${instructorId}/capacity`,
      { weeklyHours }
    );
  }

  getTimeOff(instructorId?: number, from?: string, to?: string): Observable<InstructorTimeOff[]> {
    const params: string[] = [];
    if (instructorId) params.push(`instructorId=${instructorId}`);
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return this.http.get<InstructorTimeOff[]>(`${this.getApiUrl()}/Availability/time-off${query}`);
  }

  // ── Availability requests ─────────────────────────────────────────────────

  getAvailabilityRequests(status?: string, type?: string): Observable<AvailabilityRequest[]> {
    const params: string[] = [];
    if (status) params.push(`status=${status}`);
    if (type) params.push(`type=${type}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return this.http.get<AvailabilityRequest[]>(
      `${this.getApiUrl()}/availability/requests${query}`
    );
  }

  requestTimeOff(
    payload: CreateTimeOffRequest,
    instructorId?: number
  ): Observable<AvailabilityRequest> {
    const query = instructorId ? `?instructorId=${instructorId}` : '';
    return this.http.post<AvailabilityRequest>(
      `${this.getApiUrl()}/availability/requests/time-off${query}`,
      payload
    );
  }

  requestAvailabilityChange(
    payload: CreateAvailabilityChangeRequest,
    instructorId?: number
  ): Observable<AvailabilityRequest> {
    const query = instructorId ? `?instructorId=${instructorId}` : '';
    return this.http.post<AvailabilityRequest>(
      `${this.getApiUrl()}/availability/requests/availability-change${query}`,
      payload
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
    const params: string[] = [];
    if (search.fromDate) params.push(`fromDate=${search.fromDate}`);
    if (search.weeks) params.push(`weeks=${search.weeks}`);
    if (search.instructorId) params.push(`instructorId=${search.instructorId}`);
    if (search.dayOfWeek !== undefined && search.dayOfWeek !== null) {
      params.push(`dayOfWeek=${search.dayOfWeek}`);
    }
    if (search.roomId) params.push(`roomId=${search.roomId}`);
    if (search.maxBlockedWeeks !== undefined && search.maxBlockedWeeks !== null) {
      params.push(`maxBlockedWeeks=${search.maxBlockedWeeks}`);
    }
    if (search.allStartTimes) params.push('allStartTimes=true');
    const query = params.length ? `?${params.join('&')}` : '';
    return this.http.get<AvailableSlot[]>(`${this.getApiUrl()}/Availability/slots${query}`);
  }

  // ── Holds ─────────────────────────────────────────────────────────────────

  getSlotHolds(
    options: {
      status?: SlotHoldStatus;
      readyOnly?: boolean;
      mineOnly?: boolean;
    } = {}
  ): Observable<SlotHold[]> {
    const params: string[] = [];
    if (options.status) params.push(`status=${options.status}`);
    if (options.readyOnly) params.push('readyOnly=true');
    if (options.mineOnly) params.push('mineOnly=true');
    const query = params.length ? `?${params.join('&')}` : '';
    return this.http.get<SlotHold[]>(`${this.getApiUrl()}/Sales/holds${query}`);
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
    const params: string[] = [];
    if (options.holdId) params.push(`holdId=${options.holdId}`);
    if (options.status) params.push(`status=${options.status}`);
    if (options.mineOnly) params.push('mineOnly=true');
    const query = params.length ? `?${params.join('&')}` : '';
    return this.http.get<Candidate[]>(`${this.getApiUrl()}/Sales/candidates${query}`);
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
