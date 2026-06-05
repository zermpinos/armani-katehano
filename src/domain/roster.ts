export function isStarter(note: string | null | undefined): boolean {
  if (!note) return false;
  return /^start(er|ing)?$/i.test(note.trim());
}
