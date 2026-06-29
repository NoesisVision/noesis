import { describe, expect, it } from 'bun:test';
import { ProjectIdSchema, ProjectSchema } from './project.js';

describe('ProjectIdSchema', () => {
  it('accepts a non-empty opaque id', () => {
    expect(ProjectIdSchema.parse('proj-1')).toBe('proj-1');
  });

  it('rejects an empty id', () => {
    expect(ProjectIdSchema.safeParse('').success).toBe(false);
  });
});

describe('ProjectSchema', () => {
  it('parses a project with id and name', () => {
    const result = ProjectSchema.parse({ id: 'proj-1', name: 'Noesis' });
    expect(result).toEqual({ id: 'proj-1', name: 'Noesis' });
  });
});
