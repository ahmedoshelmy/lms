import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** The name after every page's own title, and the whole title where a route has none. */
export const APP_NAME = 'Mindvalley';

/**
 * Each route's `title` names the page, followed by the app's name:
 * "Schedule · Mindvalley". Every page used to be "LmsPlatform", so a tab, the
 * history list and a screen reader all said the same thing wherever you were.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.title.setTitle(pageTitle(this.buildTitle(snapshot)));
  }
}

export function pageTitle(page: string | undefined): string {
  return page ? `${page} · ${APP_NAME}` : APP_NAME;
}
