import { AttendanceStatus } from '../enums/AttendanceStatus';
import { BulkAttendanceItem } from '../interfaces/Attendance';

/** How a child stands on the register. Pending means nobody has marked them yet. */
export type RegisterMark = 'Pending' | 'Present' | 'Late' | 'Excused' | 'Absent';

/** The parts of a register line that are sent to the server. */
export interface RegisterLine {
  studentId: number;
  status: RegisterMark;
  taskDone?: boolean | null;
  assignmentDone?: boolean | null;
}

/**
 * The status the server stores for a mark, or null for a child nobody has
 * marked.
 *
 * There is deliberately no default. Unmarked used to fall through to Present,
 * so a register saved half-way through recorded every child not yet reached as
 * having been in the room -- and the monthly report was written from that.
 */
export function markToApiStatus(mark: RegisterMark): AttendanceStatus | null {
  switch (mark) {
    case 'Present':
      return AttendanceStatus.Present;
    case 'Absent':
      return AttendanceStatus.Absent;
    case 'Late':
      return AttendanceStatus.Late;
    case 'Excused':
      return AttendanceStatus.Excused;
    case 'Pending':
      return null;
  }
}

/** How many children on the register have not been marked yet. */
export function unmarkedCount(lines: readonly RegisterLine[]): number {
  return lines.filter((line) => markToApiStatus(line.status) === null).length;
}

/**
 * The register as the server takes it, or null while anybody is still
 * unmarked. A register is sent whole or not at all: leaving the unmarked out
 * would file a register with children missing from it, which reads later as
 * "not in the group" rather than "not marked".
 */
export function buildRegisterPayload(lines: readonly RegisterLine[]): BulkAttendanceItem[] | null {
  const payload: BulkAttendanceItem[] = [];

  for (const line of lines) {
    const status = markToApiStatus(line.status);
    if (status === null) {
      return null;
    }

    payload.push({
      studentId: line.studentId,
      status,
      taskDone: line.taskDone ?? null,
      assignmentDone: line.assignmentDone ?? null,
    });
  }

  return payload;
}
