export const SOURCE_CATEGORIES = {
  official: { label: 'Official Agency', color: '#58a6ff', icon: 'shield' },
  fire_dept: { label: 'Fire Department', color: '#f85149', icon: 'fire' },
  radio: { label: 'Radio / Scanner', color: '#f0a020', icon: 'radio' },
  social: { label: 'Social Media', color: '#a371f7', icon: 'social' },
  volunteer: { label: 'Volunteer / Community', color: '#3fb950', icon: 'people' },
  news: { label: 'News', color: '#6b7280', icon: 'news' },
}

export const CATEGORY_ORDER = ['official', 'fire_dept', 'volunteer', 'radio', 'social', 'news']

export function categoryMeta(cat) {
  return SOURCE_CATEGORIES[cat] || SOURCE_CATEGORIES.news
}
