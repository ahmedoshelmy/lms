import { describe, expect, it } from 'vitest';
import { ariaSortFor } from './sort.utils';

describe('ariaSortFor', () => {
  it('names the direction of the column the table is sorted by', () => {
    expect(ariaSortFor('name', 'name', 'asc')).toBe('ascending');
    expect(ariaSortFor('name', 'name', 'desc')).toBe('descending');
  });

  it('says nothing for the other columns', () => {
    expect(ariaSortFor('email', 'name', 'asc')).toBeNull();
    expect(ariaSortFor('email', null, 'asc')).toBeNull();
  });
});
