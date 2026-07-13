export function pageEntries(value: unknown, label: string): Record<string, unknown>[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((page, index) => {
    if (
      !page ||
      typeof page !== 'object' ||
      Array.isArray(page) ||
      typeof (page as Record<string, unknown>).path !== 'string'
    ) {
      throw new Error(`${label}[${index}] must be a page object with a string path.`);
    }

    return page as Record<string, unknown>;
  });
}
