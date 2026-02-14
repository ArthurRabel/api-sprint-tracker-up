export function mockCreateListDto(boardId: string, overrides?: Record<string, unknown>) {
  const timestamp = Date.now();
  return {
    boardId,
    title: `Test List ${timestamp}`,
    position: 1,
    ...overrides,
  };
}

export function mockUpdateListDto(overrides?: Record<string, unknown>) {
  return {
    title: 'Updated List Title',
    ...overrides,
  };
}

export function mockUpdateListPositionDto(newPosition: number) {
  return {
    newPosition,
  };
}
