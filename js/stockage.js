const PREFIXE = 'mosaicomino.';
const SCHEMA = 1;
const memoire = new Map();
let coffre;

export const PREFERENCES_PAR_DEFAUT = {
    niveau: 'mosaique',
    theme: 'galerie',
    sons: true,
    vibration: true,
    contours: true
};

function obtenirCoffre() {
    if (coffre) return coffre;
    try {
        const sonde = `${PREFIXE}sonde`;
        globalThis.localStorage.setItem(sonde, '1');
        globalThis.localStorage.removeItem(sonde);
        coffre = globalThis.localStorage;
    } catch {
        coffre = {
            getItem: cle => memoire.get(cle) ?? null,
            setItem: (cle, valeur) => memoire.set(cle, String(valeur)),
            removeItem: cle => memoire.delete(cle)
        };
    }
    return coffre;
}

function lire(cle, defaut) {
    try {
        const brut = obtenirCoffre().getItem(PREFIXE + cle);
        if (!brut) return defaut;
        const enveloppe = JSON.parse(brut);
        return enveloppe?.schema === SCHEMA ? enveloppe.donnees : defaut;
    } catch { return defaut; }
}

function ecrire(cle, donnees) {
    try { obtenirCoffre().setItem(PREFIXE + cle, JSON.stringify({ schema: SCHEMA, donnees })); }
    catch { /* mémoire seulement */ }
}

export function chargerPreferences() { return { ...PREFERENCES_PAR_DEFAUT, ...lire('preferences', {}) }; }
export const enregistrerPreferences = preferences => ecrire('preferences', preferences);
export const chargerSession = () => lire('session', null);
export const enregistrerSession = session => ecrire('session', session);
export const chargerStatistiques = () => lire('statistiques', { niveaux: {}, quotidien: {}, historique: [] });

function ecartJours(a, b) {
    return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

export function enregistrerVictoire({ niveau, quotidien, dateJour, tempsMs, gestes, indices }) {
    const stats = chargerStatistiques();
    const avant = stats.niveaux[niveau] || { parties: 0, meilleurTempsMs: null, meilleursGestes: null, sansIndice: 0 };
    stats.niveaux[niveau] = {
        parties: avant.parties + 1,
        meilleurTempsMs: avant.meilleurTempsMs === null ? tempsMs : Math.min(avant.meilleurTempsMs, tempsMs),
        meilleursGestes: avant.meilleursGestes === null ? gestes : Math.min(avant.meilleursGestes, gestes),
        sansIndice: avant.sansIndice + (indices === 0 ? 1 : 0)
    };
    if (quotidien && dateJour && !(stats.quotidien.reussis || []).includes(dateJour)) {
        const suite = stats.quotidien.dernierJour && ecartJours(stats.quotidien.dernierJour, dateJour) === 1;
        stats.quotidien.serie = suite ? (stats.quotidien.serie || 0) + 1 : 1;
        stats.quotidien.meilleureSerie = Math.max(stats.quotidien.meilleureSerie || 0, stats.quotidien.serie);
        stats.quotidien.dernierJour = dateJour;
        stats.quotidien.reussis = [...(stats.quotidien.reussis || []), dateJour].slice(-180);
    }
    stats.historique.unshift({ date: new Date().toISOString(), niveau, quotidien, dateJour, tempsMs, gestes, indices });
    stats.historique = stats.historique.slice(0, 12);
    ecrire('statistiques', stats);
    return stats;
}

export function effacerStatistiques() { ecrire('statistiques', { niveaux: {}, quotidien: {}, historique: [] }); }
export function _reinitialiserPourTests() { coffre = null; memoire.clear(); }

