export interface Resource {
  id: string;
  courseId: string;
  courseTitle?: string;
  title: string;
  url: string;
  type: 'link' | 'video' | 'document' | 'other';
  addedAt: string;
  addedBy?: string;
}
