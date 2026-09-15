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

// Le compteur de poses du tampon Logique : il vit dans l'espace du joueur,
// repart à zéro chaque jour, et ne tourne pas en mode invité.
const coffrePasseport = new Map();
const espacePasseport = { getItem: cle => coffrePasseport.get(cle) ?? null, setItem: (cle, valeur) => coffrePasseport.set(cle, String(valeur)) };
check('passeport : en mode invité, rien n’est compté', stockage.compterPosePasseport('2026-09-15') === null);
for (let i = 0; i < 19; i++) stockage.compterPosePasseport('2026-09-15', espacePasseport);
check('passeport : la vingtième tesselle posée du jour atteint vingt', stockage.compterPosePasseport('2026-09-15', espacePasseport) === 20);
check('passeport : le lendemain, on repart de un', stockage.compterPosePasseport('2026-09-16', espacePasseport) === 1);
coffrePasseport.set('mosaicomino.passeport', '{cassé');
check('passeport : un compteur illisible repart proprement', stockage.compterPosePasseport('2026-09-16', espacePasseport) === 1);
check('passeport : le compteur ne touche pas au stockage du mode invité', localStorage.getItem('mosaicomino.passeport') === null);

rapport();
