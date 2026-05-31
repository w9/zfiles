export type NavigationStacks = {
  back: string[];
  forward: string[];
};

export function createNavigationStacks(): NavigationStacks {
  return { back: [], forward: [] };
}

export function pushNavigationPath(
  stacks: NavigationStacks,
  currentPath: string,
  nextPath: string,
): NavigationStacks | null {
  if (nextPath === currentPath) {
    return null;
  }
  return {
    back: [...stacks.back, currentPath],
    forward: [],
  };
}

export function navigateBack(
  stacks: NavigationStacks,
  currentPath: string,
): { stacks: NavigationStacks; path: string } | null {
  if (stacks.back.length === 0) {
    return null;
  }
  const back = [...stacks.back];
  const path = back.pop()!;
  return {
    path,
    stacks: {
      back,
      forward: [currentPath, ...stacks.forward],
    },
  };
}

export function navigateForward(
  stacks: NavigationStacks,
  currentPath: string,
): { stacks: NavigationStacks; path: string } | null {
  if (stacks.forward.length === 0) {
    return null;
  }
  const forward = [...stacks.forward];
  const path = forward.shift()!;
  return {
    path,
    stacks: {
      back: [...stacks.back, currentPath],
      forward,
    },
  };
}
