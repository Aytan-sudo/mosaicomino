export function lienDuPuzzle(base, meta) {
    const url = new URL(base);
    url.search = '';
    if (meta.dateJour) url.searchParams.set('jour', meta.dateJour);
    else {
        url.searchParams.set('seed', meta.graine);
        url.searchParams.set('niveau', meta.niveau);
    }
    return url.href;
}

export function messageDePartage({ base, meta, termine, tempsMs, gestes, indices, pieces }) {
    const lignes = [meta.dateJour
        ? `Mosaïcomino ${meta.dateJour.split('-').reverse().join('/')}`
        : `Mosaïcomino · ${meta.nomNiveau}`];
    if (termine) {
        const total = Math.floor(tempsMs / 1000);
        lignes.push(`Composé en ${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} · ${gestes} gestes`);
        lignes.push(indices ? `${indices} indice${indices > 1 ? 's' : ''}` : 'Sans indice ✦');
        lignes.push(Array.from({ length: pieces }, (_, index) => ['🔶', '🔷', '🟢', '🟣', '🟡'][index % 5]).join(''));
    } else lignes.push('Une silhouette, des formes libres. Saurez-vous tout assembler ?');
    lignes.push(lienDuPuzzle(base, meta));
    return lignes.join('\n');
}

