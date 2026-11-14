// Texto sin acentos y en minúsculas, para comparar y buscar.
export const plain = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const matchesQuery = (text, query) => {
  const q = plain(query).trim();
  return !q || plain(text).includes(q);
};
