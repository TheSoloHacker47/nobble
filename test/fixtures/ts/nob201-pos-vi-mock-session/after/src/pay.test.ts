vi.mock('./session', () => ({ currentSession: () => ({ id: 1 }) }));
it('a', () => { expect(x()).toBe(1); });
