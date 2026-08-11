const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function yearOf(dateStr) {
  if (!dateStr) return null;
  const m = /^(\d{4})/.exec(dateStr);
  return m ? Number(m[1]) : null;
}

export function formatDateFr(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!month) return year;
  const monthName = MONTHS_FR[Number(month) - 1];
  if (!day) return `${monthName} ${year}`;
  return `${Number(day)} ${monthName} ${year}`;
}
