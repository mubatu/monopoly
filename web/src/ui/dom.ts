/** Looks up an element that index.html is known to contain. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`#${id} bulunamadı.`);
  return element as T;
}
