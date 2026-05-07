const formatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatArticleDate(date: Date): string {
  return formatter.format(date);
}
