/**
 * Backup automatico del Catalogo Prodotti su Google Drive.
 * Il 1° di ogni mese crea un Foglio Google con due schede (Prodotti e Offerte)
 * nella cartella BackUp_App. Gira sui server di Google: telefono e PC possono essere spenti.
 *
 * Da fare una volta: esegui "installaBackupMensile" e concedi i permessi,
 * poi esegui "backupCatalogo" per provare subito.
 */
const PROJECT_ID = 'le-mie-note-d18dd';
const FOLDER_ID = '1iZw_jKiBdSL65Rmh-M8qp-vaqcBHpwok'; // cartella BackUp_App

const COLONNE = [
  ['c', 'Codice'], ['k', 'Categoria'], ['n', 'Descrizione'], ['f', 'Fornitore'],
  ['u', 'Unità acquisto'], ['q', 'Qtà per unità'], ['um', 'Unità singola'],
  ['p', 'Prezzo imponibile €'], ['iva', 'IVA %'], ['t', 'Totale con IVA €'], ['cu', 'Costo unitario €'],
  ['s1', 'Sconto %'], ['ps', 'Prezzo dopo sconto €'], ['s2', 'Sconto ulteriore % dopo essere scontato'],
  ['pf', 'Prezzo finale €'], ['note', 'Note'], ['agg', 'Ultima modifica'],
];

function backupCatalogo() {
  const prodotti = leggiCatalogo_();
  if (!prodotti.length) throw new Error('Il catalogo risulta vuoto: backup non creato.');
  prodotti.sort((a, b) => String(a.c).localeCompare(String(b.c)));

  const oggi = Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd');
  const ss = SpreadsheetApp.create('Backup Catalogo Prodotti ' + oggi);

  const valore = (p, k) => {
    let v = p[k];
    if (v === undefined || v === null) return '';
    if (k === 's1' || k === 's2') return Math.round(v * 100 * 1e4) / 1e4;
    if (k === 'agg') return String(v).slice(0, 10);
    return v;
  };

  const sh = ss.getSheets()[0].setName('Prodotti');
  const righe = prodotti.map(p => COLONNE.map(([k]) => valore(p, k)));
  sh.getRange(1, 1, 1, COLONNE.length).setValues([COLONNE.map(c => c[1])]).setFontWeight('bold');
  sh.getRange(2, 1, righe.length, COLONNE.length).setValues(righe);
  sh.setFrozenRows(1);

  const off = ss.insertSheet('Offerte');
  const intest = ['Codice prodotto', 'Descrizione'].concat(COLONNE.slice(3, 15).map(c => c[1]), ['Netto € per unità', 'Data offerta']);
  const righeOff = [];
  prodotti.forEach(p => (p.offerte || []).forEach(o => {
    const netto = o.pf != null ? o.pf : (o.ps != null ? o.ps : (o.cu != null ? o.cu : ''));
    righeOff.push([p.c, p.n].concat(COLONNE.slice(3, 15).map(([k]) => valore(o, k)), [netto, valore(o, 'agg')]));
  }));
  off.getRange(1, 1, 1, intest.length).setValues([intest]).setFontWeight('bold');
  if (righeOff.length) off.getRange(2, 1, righeOff.length, intest.length).setValues(righeOff);
  off.setFrozenRows(1);

  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(FOLDER_ID));
  console.log('Backup creato: ' + prodotti.length + ' prodotti, ' + righeOff.length + ' offerte. ' + ss.getUrl());
}

/** Legge tutta la collezione "catalogo" da Firestore con il tuo account Google. */
function leggiCatalogo_() {
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/catalogo?pageSize=300';
  const headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID };
  const out = [];
  let token = '';
  do {
    const res = UrlFetchApp.fetch(base + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { headers, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Firestore ha risposto ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 500));
    const json = JSON.parse(res.getContentText());
    (json.documents || []).forEach(d => out.push(daFirestore_({ mapValue: { fields: d.fields || {} } })));
    token = json.nextPageToken || '';
  } while (token);
  return out;
}

function daFirestore_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(daFirestore_);
  if ('mapValue' in v) {
    const o = {};
    Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { o[k] = daFirestore_(x); });
    return o;
  }
  return null;
}

/** Da eseguire una volta: programma il backup il 1° di ogni mese alle 9. */
function installaBackupMensile() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'backupCatalogo')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupCatalogo').timeBased().onMonthDay(1).atHour(9).inTimezone('Europe/Rome').create();
  console.log('Backup mensile programmato: il 1° di ogni mese verso le 9.');
}
