import { compteur } from './harness.mjs';
const memoire = new Map();
globalThis.localStorage = {
    getItem: cle => memoire.get(cle) ?? null,
    setItem: (cle, valeur) => memoire.set(cle, String(valeur)),
    removeItem: cle => memoire.delete(cle)
};
const stockage = await import('../js/stockage.js');
stockage._reinitialiserPourTests();
const { check, rapport } = compteur();
console.log('\nSauvegarde locale\n');

check('les préférences initiales sont complètes', stockage.chargerPreferences().niveau === 'mosaique');
stockage.enregistrerPreferences({ ...stockage.chargerPreferences(), theme: 'argile' });
check('le thème est conservé', stockage.chargerPreferences().theme === 'argile');
stockage.enregistrerSession({ gestes: 7, puzzle: 'test' });
check('la composition en cours est conservée', stockage.chargerSession().gestes === 7);

stockage.enregistrerVictoire({ niveau: 'mosaique', quotidien: true, dateJour: '2026-08-22', tempsMs: 90000, gestes: 30, indices: 0 });
stockage.enregistrerVictoire({ niveau: 'mosaique', quotidien: true, dateJour: '2026-08-23', tempsMs: 80000, gestes: 27, indices: 1 });
const stats = stockage.chargerStatistiques();
check('deux jours consécutifs forment une série', stats.quotidien.serie === 2);
check('le meilleur résultat remplace le précédent', stats.niveaux.mosaique.meilleurTempsMs === 80000 && stats.niveaux.mosaique.meilleursGestes === 27);
check('les compositions sans indice sont comptées', stats.niveaux.mosaique.sansIndice === 1);

rapport();

