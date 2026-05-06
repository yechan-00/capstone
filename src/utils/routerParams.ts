/** expo-router search params는 string | string[] 일 수 있음 */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}
