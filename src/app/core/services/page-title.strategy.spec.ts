import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Route, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { APP_NAME, PageTitleStrategy, pageTitle } from './page-title.strategy';

@Component({ template: '' })
class BlankPage {}

/** Every route that shows a page of its own (not a redirect or the shell). */
function pages(list: Route[], out: Route[] = []): Route[] {
  for (const route of list) {
    if (route.children) pages(route.children, out);
    else if (route.loadComponent || route.component) out.push(route);
  }
  return out;
}

describe('page titles', () => {
  it('names every page, rather than one title for the whole site', () => {
    const untitled = pages(routes)
      .filter((r) => typeof r.title !== 'string' || !r.title.trim())
      .map((r) => r.path);

    expect(untitled).toEqual([]);
  });

  it('puts the page before the app name', () => {
    expect(pageTitle('Schedule')).toBe(`Schedule · ${APP_NAME}`);
    expect(pageTitle(undefined)).toBe(APP_NAME);
  });

  it('sets the document title as the route changes', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'groups', title: 'Groups', component: BlankPage },
          { path: 'blank', component: BlankPage },
        ]),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const title = TestBed.inject(Title);

    await harness.navigateByUrl('/groups');
    expect(title.getTitle()).toBe(`Groups · ${APP_NAME}`);

    await harness.navigateByUrl('/blank');
    expect(title.getTitle()).toBe(APP_NAME);
  });
});
