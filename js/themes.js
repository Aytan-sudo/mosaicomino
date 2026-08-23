export const THEMES = [
    { id: 'galerie', nom: 'Galerie', couleur: '#d7a75d' },
    { id: 'lagon', nom: 'Lagon', couleur: '#4eb7b1' },
    { id: 'argile', nom: 'Argile', couleur: '#d47158' },
    { id: 'encre', nom: 'Encre', couleur: '#8797dc' },
    { id: 'ivoire', nom: 'Ivoire', couleur: '#9b684f' },
    { id: 'verger', nom: 'Verger', couleur: '#82ad65' }
];

export function themeSuivant(id) {
    const index = THEMES.findIndex(theme => theme.id === id);
    return THEMES[(index + 1 + THEMES.length) % THEMES.length].id;
}

