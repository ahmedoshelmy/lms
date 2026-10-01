/**
 * The school in one screen, counted on the server.
 *
 * The front page used to fetch every group, every student and a month of
 * classes and add them up itself, which is how it came to disagree with the
 * groups page about how many groups were running.
 */
export interface DashboardOverview {
  /** Groups teaching now, as opposed to finished, stopped or shelved. */
  runningGroups: number;

  /** Children in those groups, counted by head rather than by adding sizes. */
  studentsInRunningGroups: number;

  /** Every student on the books, in a group or not. */
  totalStudents: number;

  /** Hours of class a week the running groups come to. */
  runningGroupHoursPerWeek: number;

  /** Hours a week the instructors are between them allowed to teach. */
  instructorCapacityHoursPerWeek: number;

  activeInstructors: number;

  /** How many instructors have no weekly limit set, so add nothing above. */
  instructorsWithoutLimit: number;

  groupsByTopic: TopicGroupCount[];

  cancelledThisMonth: number;

  cancellationCauses: CancellationCauseShare[];
}

export interface TopicGroupCount {
  topicCode: string;
  topicName: string;
  groups: number;
}

export interface CancellationCauseShare {
  /** Instructor, Parents, Holiday, or "Not given" for the older ones. */
  cause: string;
  count: number;
  percent: number;
}
